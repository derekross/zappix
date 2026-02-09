import { useState, useRef, useCallback } from "react";
import { Upload, Image as ImageIcon, Video } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import {
  MediaPreviewGrid,
  UploadProgress,
  VideoRequirements,
  LocationPicker,
  PostTypeSelector,
  ContentWarningToggle,
  HashtagInput,
  type UploadedMedia,
} from "./create-post";
import {
  generateBlurhash,
  getVideoMetadata,
  getImageDimensions,
  parseHashtags,
  SUPPORTED_VIDEO_TYPES,
  MAX_VIDEO_DURATION,
} from "@/lib/mediaUtils";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [geohash, setGeohash] = useState("");
  const [contentWarning, setContentWarning] = useState("");
  const [hasContentWarning, setHasContentWarning] = useState(false);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState("");
  const [postType, setPostType] = useState<"image" | "video">("image");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useCurrentUser();
  const uploadFileMutation = useUploadFile();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();

  const handlePostTypeChange = useCallback((type: "image" | "video") => {
    setPostType(type);
    setMedia([]);
  }, []);

  const handleLocationChange = useCallback((newLocation: string, newGeohash: string) => {
    setLocation(newLocation);
    setGeohash(newGeohash);
  }, []);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const newMedia: UploadedMedia[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileName(file.name);
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

        if ((postType === "image" && !isImage) || (postType === "video" && !isVideo)) {
          toast({
            title: "File type mismatch",
            description: postType === "video"
              ? "Please select only video files (MP4, WebM, MOV) for short vertical videos"
              : `Please select only ${postType} files for this post type`,
            variant: "destructive",
          });
          continue;
        }

        if (isVideo && !SUPPORTED_VIDEO_TYPES.includes(file.type)) {
          toast({
            title: "Unsupported video format",
            description: `File type "${file.type}" is not supported. Please use MP4, WebM, or MOV format.`,
            variant: "destructive",
          });
          continue;
        }

        if (isVideo) {
          const fileSizeMB = file.size / (1024 * 1024);
          if (fileSizeMB > 5) {
            const compressionLevel = fileSizeMB > 100 ? "maximum" : fileSizeMB > 50 ? "high" : "standard";
            toast({
              title: "Video compression",
              description: `Large video detected (${fileSizeMB.toFixed(1)}MB). Applying ${compressionLevel} compression for mobile optimization.`,
            });
          }
        }

        const preview = URL.createObjectURL(file);
        let dimensions: { width: number; height: number };
        let duration: number | undefined;
        let thumbnail: string | undefined;
        let blurhash: string | undefined;

        if (isImage) {
          blurhash = await generateBlurhash(file);
          dimensions = await getImageDimensions(file);
        } else {
          try {
            const videoMeta = await getVideoMetadata(file);
            dimensions = { width: videoMeta.width, height: videoMeta.height };
            duration = videoMeta.duration;
            thumbnail = videoMeta.thumbnail;

            if (videoMeta.height <= videoMeta.width) {
              const aspectRatio = (videoMeta.width / videoMeta.height).toFixed(2);
              toast({
                title: "Invalid video orientation",
                description: `Video must be vertical (portrait). Current aspect ratio: ${aspectRatio}:1 (landscape). Please upload a vertical video where height > width.`,
                variant: "destructive",
              });
              continue;
            }

            if (videoMeta.duration > MAX_VIDEO_DURATION) {
              const minutes = Math.floor(videoMeta.duration / 60);
              const seconds = Math.round(videoMeta.duration % 60);
              toast({
                title: "Video too long",
                description: `Video duration is ${minutes}:${seconds.toString().padStart(2, "0")}. Maximum allowed duration is 3:00 minutes.`,
                variant: "destructive",
              });
              continue;
            }
          } catch {
            toast({
              title: "Video processing failed",
              description: `Could not process video "${file.name}". Please ensure it's a valid video file.`,
              variant: "destructive",
            });
            continue;
          }
        }

        let tags: string[][];
        let url: string;

        try {
          tags = await uploadFileMutation.mutateAsync({
            file,
            options: {
              onProgress: (progress) => setUploadProgress(progress),
            },
          });

          if (!tags || tags.length === 0 || !tags[0] || !tags[0][1]) {
            throw new Error("Upload returned invalid response - no URL received");
          }

          url = tags[0][1];
        } catch (uploadError) {
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
            variant: "destructive",
          });
          continue;
        }

        const uploadMimeTag = tags.find(([name]) => name === "m");
        const mimeType = uploadMimeTag ? uploadMimeTag[1] : file.type;
        const urlFileName = url.split("/").pop() || file.name;

        const imetaContent = [
          `url ${url}`,
          `m ${mimeType}`,
          `dim ${dimensions.width}x${dimensions.height}`,
          `alt ${urlFileName}`,
        ];

        if (blurhash) imetaContent.push(`blurhash ${blurhash}`);
        if (thumbnail) imetaContent.push(`image ${thumbnail}`);

        const additionalTags = tags.slice(1).filter(([name]) => name !== "m");
        additionalTags.forEach(([name, value]) => {
          if (!imetaContent.some((content) => content.startsWith(`${name} `))) {
            imetaContent.push(`${name} ${value}`);
          }
        });

        const imetaTag: string[] = ["imeta", ...imetaContent];

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

      if (newMedia.length > 0) {
        toast({
          title: `${postType === "image" ? "Images" : "Short vertical videos"} uploaded!`,
          description: `${newMedia.length} ${postType === "image" ? "image" : "short vertical video"}${newMedia.length !== 1 ? "s" : ""} uploaded successfully`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Upload failed",
        description: postType === "video"
          ? `Failed to upload short vertical videos: ${errorMessage}. Please ensure they are vertical orientation and under 3 minutes.`
          : `Failed to upload ${postType}s: ${errorMessage}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentFileName("");
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
        description: postType === "video"
          ? "Please add a description and at least one short vertical video"
          : `Please add a description and at least one ${postType}`,
        variant: "destructive",
      });
      return;
    }

    try {
      const tags: string[][] = [];

      if (postType === "video") {
        const title = content.split("\n")[0].trim() || `Short Video by ${user.pubkey.slice(0, 8)}`;
        tags.push(["title", title]);
      }

      media.forEach((item) => tags.push(...item.tags));

      if (postType === "video" && media[0].duration) {
        tags.push(["duration", media[0].duration.toString()]);
      }

      if (hashtags.trim()) {
        parseHashtags(hashtags).forEach((tag) => tags.push(["t", tag]));
      }

      if (location.trim()) tags.push(["location", location.trim()]);
      if (geohash.trim()) tags.push(["g", geohash.trim()]);
      if (hasContentWarning && contentWarning.trim()) {
        tags.push(["content-warning", contentWarning.trim()]);
      }

      const kind = postType === "image" ? 20 : 22;

      createEvent(
        { kind, content: content.trim(), tags },
        {
          onSuccess: () => {
            setContent("");
            setHashtags("");
            setLocation("");
            setGeohash("");
            setContentWarning("");
            setHasContentWarning(false);
            // Revoke all object URLs before clearing media to prevent memory leaks
            media.forEach((item) => URL.revokeObjectURL(item.preview));
            setMedia([]);
            onOpenChange(false);

            toast({
              title: "Post created!",
              description: postType === "video"
                ? "Your Flix has been published and will appear in the feed shortly"
                : `Your ${postType === "image" ? "Pix" : postType} has been published and will appear in the feed shortly`,
            });
          },
          onError: (error) => {
            toast({
              title: "Failed to create post",
              description: error instanceof Error ? error.message : "Please try again",
              variant: "destructive",
            });
          },
        }
      );
    } catch {
      toast({
        title: "Failed to create post",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {postType === "image" ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <Video className="h-5 w-5 text-primary" />
            )}
            <span>Create {postType === "image" ? "Pix" : "Flix"} Post</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 w-full min-w-0">
          <PostTypeSelector postType={postType} onPostTypeChange={handlePostTypeChange} />

          {postType === "video" && <VideoRequirements />}

          {/* Media Upload */}
          <div className="space-y-4">
            <Label>{postType === "image" ? "Images" : "Short Vertical Videos"} *</Label>

            <MediaPreviewGrid media={media} onRemove={removeMedia} />

            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || uploadFileMutation.isPending}
            >
              <div className="text-center space-y-2">
                {isUploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {isUploading
                      ? postType === "video"
                        ? "Compressing & Uploading..."
                        : "Uploading Images..."
                      : `Upload ${postType === "image" ? "Images" : "Short Vertical Videos"}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isUploading
                      ? postType === "video"
                        ? "Compressing for mobile optimization and uploading..."
                        : "Processing images and uploading to server..."
                      : postType === "image"
                        ? "Click to select multiple images"
                        : "Click to select vertical videos (max 3 minutes each)"}
                  </p>
                </div>
              </div>
            </Button>

            {isUploading && (
              <UploadProgress
                progress={uploadProgress}
                currentFileName={currentFileName}
                postType={postType}
              />
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
              placeholder={`What's zappening with your ${postType === "image" ? "pix" : "flix"}...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <HashtagInput hashtags={hashtags} onHashtagsChange={setHashtags} />

          <LocationPicker
            location={location}
            geohash={geohash}
            onLocationChange={handleLocationChange}
            dialogOpen={open}
          />

          <ContentWarningToggle
            hasContentWarning={hasContentWarning}
            contentWarning={contentWarning}
            onHasContentWarningChange={setHasContentWarning}
            onContentWarningChange={setContentWarning}
          />

          {/* Submit Button */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!user || media.length === 0 || !content.trim() || isUploading || uploadFileMutation.isPending}
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
