import { useState, useRef } from "react";
import {
  Upload,
  X,
  AlertTriangle,
  Hash,
  Image as ImageIcon,
  MapPin,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/useToast";
import { encode } from "blurhash";
import { encode as encodeGeohash } from "ngeohash";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadedImage {
  file: File;
  url: string;
  tags: string[][];
  preview: string;
  blurhash?: string;
  dimensions?: string;
  alt?: string;
}

export function CreatePostDialog({
  open,
  onOpenChange,
}: CreatePostDialogProps) {
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [geohash, setGeohash] = useState("");
  const [contentWarning, setContentWarning] = useState("");
  const [hasContentWarning, setHasContentWarning] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();

  // Generate blurhash for an image
  const generateBlurhash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Resize image for faster blurhash generation
        const maxSize = 32;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Generate blurhash
        const hash = encode(imageData.data, canvas.width, canvas.height, 4, 3);
        resolve(hash);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const newImages: UploadedImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith("image/")) {
          toast({
            title: "Invalid file type",
            description: "Please select only image files",
            variant: "destructive",
          });
          continue;
        }

        // Create preview URL
        const preview = URL.createObjectURL(file);

        // Generate blurhash
        const blurhash = await generateBlurhash(file);

        // Get image dimensions
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve) => {
            const img = new Image();
            img.onload = () =>
              resolve({ width: img.width, height: img.height });
            img.src = preview;
          }
        );

        // Upload file
        const tags = await uploadFile(file);
        const url = tags[0][1]; // First tag contains the URL

        // Create imeta tag with all required fields
        const imetaTag: string[] = [
          "imeta",
          `url ${url}`,
          `m ${file.type}`,
          `blurhash ${blurhash}`,
          `dim ${dimensions.width}x${dimensions.height}`,
          `alt ${file.name}`,
          ...tags.slice(1).map((tag) => tag[1]), // Include any additional tags from uploadFile
        ];

        newImages.push({
          file,
          url,
          tags: [imetaTag],
          preview,
          blurhash,
          dimensions: `${dimensions.width}x${dimensions.height}`,
          alt: file.name,
        });

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      setImages((prev) => [...prev, ...newImages]);

      toast({
        title: "Images uploaded!",
        description: `${newImages.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSubmit = async () => {
    if (!user || images.length === 0 || !content.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please add a description and at least one image",
        variant: "destructive",
      });
      return;
    }

    try {
      const tags: string[][] = [];

      // Add image metadata tags
      images.forEach((image) => {
        tags.push(...image.tags);
      });

      // Add hashtags
      if (hashtags.trim()) {
        const hashtagList = hashtags
          .split(/[,\s]+/)
          .map((tag) => tag.replace(/^#/, "").trim())
          .filter((tag) => tag.length > 0);

        hashtagList.forEach((tag) => {
          tags.push(["t", tag]);
        });
      }

      // Add location
      if (location.trim()) {
        tags.push(["location", location.trim()]);
      }

      // Add geohash
      if (geohash.trim()) {
        tags.push(["g", geohash.trim()]);
      }

      // Add content warning
      if (hasContentWarning && contentWarning.trim()) {
        tags.push(["content-warning", contentWarning.trim()]);
      }

      // Add media type tag
      tags.push(["m", images[0].file.type]);

      createEvent({
        kind: 20,
        content: content.trim(),
        tags,
      });

      // Reset form
      setContent("");
      setHashtags("");
      setLocation("");
      setGeohash("");
      setContentWarning("");
      setHasContentWarning(false);
      setImages([]);

      onOpenChange(false);

      toast({
        title: "Post created!",
        description: "Your image post has been published",
      });
    } catch (error) {
      console.error("Create post error:", error);
      toast({
        title: "Failed to create post",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const parseHashtags = (text: string) => {
    return text
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag.length > 0);
  };

  const getLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // Convert to geohash
      const hash = encodeGeohash(latitude, longitude, 7); // 7 characters gives ~150m precision
      setGeohash(hash);

      // Reverse geocode to get location name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
        );
        const data = (await response.json()) as {
          address: {
            city?: string;
            state?: string;
            country?: string;
          };
        };

        // Format location name
        const locationParts: string[] = [];
        if (data.address.city) locationParts.push(data.address.city);
        if (data.address.state) locationParts.push(data.address.state);
        if (data.address.country) locationParts.push(data.address.country);

        setLocation(locationParts.join(", "));
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        // If reverse geocoding fails, just use coordinates
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }

      toast({
        title: "Location found!",
        description: "Your location has been added to the post",
      });
    } catch (error) {
      console.error("Geolocation error:", error);
      toast({
        title: "Location error",
        description:
          "Could not get your location. Please try again or enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <span>Create Image Post</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-4">
            <Label>Images *</Label>

            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <div className="text-center space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {isUploading ? "Uploading..." : "Upload Images"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click to select multiple images
                  </p>
                </div>
              </div>
            </Button>

            {isUploading && (
              <Progress value={uploadProgress} className="w-full" />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="content">Description *</Label>
            <Textarea
              id="content"
              placeholder="Tell us about your images..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              placeholder="Add hashtags (comma separated)"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
            {hashtags && (
              <div className="flex flex-wrap gap-1">
                {parseHashtags(hashtags).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    <Hash className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <Input
                id="location"
                placeholder="City, State, Country"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={getLocation}
                disabled={isGettingLocation}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Warning */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="content-warning"
                checked={hasContentWarning}
                onCheckedChange={setHasContentWarning}
              />
              <Label
                htmlFor="content-warning"
                className="flex items-center space-x-2"
              >
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span>Content Warning</span>
              </Label>
            </div>

            {hasContentWarning && (
              <Input
                placeholder="Describe the sensitive content..."
                value={contentWarning}
                onChange={(e) => setContentWarning(e.target.value)}
              />
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !user || images.length === 0 || !content.trim() || isUploading
              }
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              Publish Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
