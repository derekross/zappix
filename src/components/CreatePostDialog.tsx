import { useState, useRef } from "react";
import {
  Upload,
  X,
  AlertTriangle,
  Hash,
  Image as ImageIcon,
  Video,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { encode } from "blurhash";
import { encode as encodeGeohash } from "ngeohash";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UploadedMedia {
  file: File;
  url: string;
  tags: string[][];
  preview: string;
  blurhash?: string;
  dimensions?: string;
  alt?: string;
  type: "image" | "video";
  duration?: number;
  thumbnail?: string;
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
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [postType, setPostType] = useState<"image" | "video">("image");

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

  // Get video metadata
  const getVideoMetadata = async (
    file: File
  ): Promise<{
    width: number;
    height: number;
    duration: number;
    thumbnail?: string;
  }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        try {
          // Ensure we have valid dimensions
          const width = video.videoWidth;
          const height = video.videoHeight;
          const duration = video.duration;

          // Validate that we got actual metadata
          if (!width || !height || width <= 0 || height <= 0) {
            reject(new Error("Could not determine video dimensions"));
            return;
          }

          if (isNaN(duration) || duration <= 0) {
            reject(new Error("Could not determine video duration"));
            return;
          }

          resolve({
            width,
            height,
            duration: Math.round(duration),
          });
        } catch (error) {
          reject(error);
        } finally {
          // Clean up the object URL
          URL.revokeObjectURL(video.src);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Failed to load video"));
      };

      // Timeout after 10 seconds (increased from 5)
      setTimeout(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Video metadata loading timeout"));
      }, 10000);
    });
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const newMedia: UploadedMedia[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
          toast({
            title: "Invalid file type",
            description: "Please select only image or video files",
            variant: "destructive",
          });
          continue;
        }

        // Check if file type matches current post type
        if (
          (postType === "image" && !isImage) ||
          (postType === "video" && !isVideo)
        ) {
          toast({
            title: "File type mismatch",
            description:
              postType === "video"
                ? "Please select only video files (MP4, WebM, MOV) for short vertical videos"
                : `Please select only ${postType} files for this post type`,
            variant: "destructive",
          });
          continue;
        }

        // Additional validation for video file types
        if (isVideo) {
          const supportedVideoTypes = [
            'video/mp4',
            'video/webm', 
            'video/quicktime', // .mov files
            'video/x-msvideo', // .avi files
            'video/ogg'
          ];
          
          if (!supportedVideoTypes.includes(file.type)) {
            toast({
              title: "Unsupported video format",
              description: `File type "${file.type}" is not supported. Please use MP4, WebM, or MOV format.`,
              variant: "destructive",
            });
            continue;
          }
        }

        // Create preview URL
        const preview = URL.createObjectURL(file);

        let dimensions: { width: number; height: number };
        let duration: number | undefined;
        let thumbnail: string | undefined;
        let blurhash: string | undefined;

        if (isImage) {
          // Generate blurhash for images
          blurhash = await generateBlurhash(file);

          // Get image dimensions
          dimensions = await new Promise<{ width: number; height: number }>(
            (resolve) => {
              const img = new Image();
              img.onload = () =>
                resolve({ width: img.width, height: img.height });
              img.src = preview;
            }
          );
        } else {
          // Get video metadata
          try {
            const videoMeta = await getVideoMetadata(file);
            dimensions = { width: videoMeta.width, height: videoMeta.height };
            duration = videoMeta.duration;
            thumbnail = videoMeta.thumbnail;

            // Enforce short vertical video restrictions
            const maxDurationSeconds = 3 * 60; // 3 minutes = 180 seconds

            console.log(`Video metadata for ${file.name}:`, {
              width: videoMeta.width,
              height: videoMeta.height,
              duration: videoMeta.duration,
              isVertical: videoMeta.height > videoMeta.width,
              aspectRatio: (videoMeta.height / videoMeta.width).toFixed(2)
            });

            // Check if video is vertical (height > width)
            if (videoMeta.height <= videoMeta.width) {
              const aspectRatio = (videoMeta.width / videoMeta.height).toFixed(2);
              toast({
                title: "Invalid video orientation",
                description: `Video must be vertical (portrait). Current aspect ratio: ${aspectRatio}:1 (landscape). Please upload a vertical video where height > width.`,
                variant: "destructive",
              });
              continue;
            }

            // Check if video duration is within limit
            if (videoMeta.duration > maxDurationSeconds) {
              const minutes = Math.floor(videoMeta.duration / 60);
              const seconds = Math.round(videoMeta.duration % 60);
              toast({
                title: "Video too long",
                description: `Video duration is ${minutes}:${seconds
                  .toString()
                  .padStart(2, "0")}. Maximum allowed duration is 3:00 minutes.`,
                variant: "destructive",
              });
              continue;
            }
          } catch (metadataError) {
            console.error("Failed to get video metadata:", metadataError);
            toast({
              title: "Video processing failed",
              description: `Could not process video "${file.name}". Please ensure it's a valid video file.`,
              variant: "destructive",
            });
            continue;
          }

          // All videos are kind 22 (short vertical videos)
        }

        // Upload file
        const tags = await uploadFile(file);
        const url = tags[0][1]; // First tag contains the URL

        // Create imeta tag with all required fields
        const imetaTag: string[] = [
          "imeta",
          `url ${url}`,
          `m ${file.type}`,
          `dim ${dimensions.width}x${dimensions.height}`,
          `alt ${file.name}`,
        ];

        // Add blurhash for images
        if (blurhash) {
          imetaTag.push(`blurhash ${blurhash}`);
        }

        // Add thumbnail for videos (if available)
        if (thumbnail) {
          imetaTag.push(`image ${thumbnail}`);
        }

        // Include any additional tags from uploadFile
        imetaTag.push(...tags.slice(1).map((tag) => tag[1]));

        newMedia.push({
          file,
          url,
          tags: [imetaTag],
          preview,
          blurhash,
          dimensions: `${dimensions.width}x${dimensions.height}`,
          alt: file.name,
          type: isImage ? "image" : "video",
          duration,
          thumbnail,
        });

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      setMedia((prev) => [...prev, ...newMedia]);

      toast({
        title: `${
          postType === "image" ? "Images" : "Short vertical videos"
        } uploaded!`,
        description: `${newMedia.length} ${
          postType === "image" ? "image" : "short vertical video"
        }${newMedia.length !== 1 ? "s" : ""} uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Upload failed",
        description:
          postType === "video"
            ? `Failed to upload short vertical videos: ${errorMessage}. Please ensure they are vertical orientation and under 3 minutes.`
            : `Failed to upload ${postType}s: ${errorMessage}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => {
      const newMedia = [...prev];
      URL.revokeObjectURL(newMedia[index].preview);
      newMedia.splice(index, 1);
      return newMedia;
    });
  };

  const handleSubmit = async () => {
    if (!user || media.length === 0 || !content.trim()) {
      toast({
        title: "Missing required fields",
        description:
          postType === "video"
            ? "Please add a description and at least one short vertical video"
            : `Please add a description and at least one ${postType}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const tags: string[][] = [];

      // Add title tag (required for NIP-71 kind 22 videos)
      if (postType === "video") {
        // Use first line of content as title, or generate one
        const title =
          content.split("\n")[0].trim() ||
          `Short Video by ${user.pubkey.slice(0, 8)}`;
        tags.push(["title", title]);
      }

      // Add media metadata tags
      media.forEach((item) => {
        tags.push(...item.tags);
      });

      // Add duration for videos
      if (postType === "video" && media[0].duration) {
        tags.push(["duration", media[0].duration.toString()]);
      }

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

      // Determine event kind based on post type
      let kind: number;
      if (postType === "image") {
        kind = 20; // NIP-68 image events
      } else {
        // For videos, always use kind 22 (short vertical videos)
        kind = 22;
      }

      createEvent({
        kind,
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
      setMedia([]);
      // Videos are always kind 22 (short vertical videos)

      onOpenChange(false);

      toast({
        title: "Post created!",
        description:
          postType === "video"
            ? "Your short vertical video has been published"
            : `Your ${postType} post has been published`,
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
            {postType === "image" ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <Video className="h-5 w-5 text-primary" />
            )}
            <span>
              Create {postType === "image" ? "Image" : "Short Vertical Video"}{" "}
              Post
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Post Type Selector */}
          <div className="space-y-2">
            <Label>Post Type</Label>
            <Tabs
              value={postType}
              onValueChange={(value) => {
                setPostType(value as "image" | "video");
                setMedia([]); // Clear media when switching types
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="image"
                  className="flex items-center space-x-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>Images</span>
                </TabsTrigger>
                <TabsTrigger
                  value="video"
                  className="flex items-center space-x-2"
                >
                  <Video className="h-4 w-4" />
                  <span>Short Vertical Videos</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Video Requirements Info */}
          {postType === "video" && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Video className="h-5 w-5 text-primary" />
                <Label className="font-medium">Video Requirements</Label>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>
                    Must be vertical/portrait orientation (height &gt; width)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Maximum duration: 3 minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Supported formats: MP4, WebM, MOV</span>
                </div>
              </div>
            </div>
          )}

          {/* Media Upload */}
          <div className="space-y-4">
            <Label>
              {postType === "image" ? "Images" : "Short Vertical Videos"} *
            </Label>

            {media.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {media.map((item, index) => (
                  <div key={index} className="relative group">
                    {item.type === "image" ? (
                      <img
                        src={item.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                    ) : (
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
                        <video
                          src={item.preview}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Video className="h-8 w-8 text-white opacity-80" />
                        </div>
                        {item.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {Math.floor(item.duration / 60)}:
                            {Math.round(item.duration % 60)
                              .toString()
                              .padStart(2, "0")}
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMedia(index)}
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
                    {isUploading
                      ? "Uploading..."
                      : `Upload ${
                          postType === "image"
                            ? "Images"
                            : "Short Vertical Videos"
                        }`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {postType === "image"
                      ? "Click to select multiple images"
                      : "Click to select vertical videos (max 3 minutes each)"}
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
              accept={postType === "image" ? "image/*" : "video/*"}
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
              placeholder={`What's zappening with your ${
                postType === "image" ? "images" : "short videos"
              }...`}
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
                !user || media.length === 0 || !content.trim() || isUploading
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
