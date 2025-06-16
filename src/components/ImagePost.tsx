import { useState } from 'react';
import { Heart, MessageCircle, Zap, MoreHorizontal, MapPin, Hash } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { useReactions } from '@/hooks/useReactions';
import { useZaps } from '@/hooks/useZaps';
import { useComments } from '@/hooks/useComments';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { genUserName } from '@/lib/genUserName';
import { ImagePostActions } from './ImagePostActions';
import { CommentSection } from './CommentSection';
import { cn } from '@/lib/utils';

interface ImagePostProps {
  event: NostrEvent;
  className?: string;
}

export function ImagePost({ event, className }: ImagePostProps) {
  const [showComments, setShowComments] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const author = useAuthor(event.pubkey);
  const reactions = useReactions(event.id);
  const zaps = useZaps(event.id);
  const comments = useComments(event.id, event.pubkey);
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(event.pubkey);
  const profileImage = metadata?.picture;
  
  // Parse event data
  const title = event.tags.find(([name]) => name === 'title')?.[1] || '';
  const imetaTags = event.tags.filter(([name]) => name === 'imeta');
  const hashtags = event.tags.filter(([name]) => name === 't').map(([, tag]) => tag);
  const location = event.tags.find(([name]) => name === 'location')?.[1];
  const geohash = event.tags.find(([name]) => name === 'g')?.[1];
  const contentWarning = event.tags.find(([name]) => name === 'content-warning')?.[1];
  
  // Parse image URLs from imeta tags
  const images = imetaTags.map(tag => {
    const urlPart = tag.find(part => part.startsWith('url '));
    const url = urlPart?.replace('url ', '');
    const altPart = tag.find(part => part.startsWith('alt '));
    const alt = altPart?.replace('alt ', '');
    const dimPart = tag.find(part => part.startsWith('dim '));
    const dimensions = dimPart?.replace('dim ', '');
    
    return { url, alt, dimensions };
  }).filter(img => img.url);
  
  const likeCount = reactions.data?.['+']?.count || 0;
  const zapCount = zaps.data?.count || 0;
  const zapTotal = zaps.data?.totalSats || 0;
  const commentCount = comments.data?.length || 0;
  
  if (images.length === 0) return null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.created_at * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActions(!showActions)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        {showActions && (
          <ImagePostActions 
            event={event} 
            onClose={() => setShowActions(false)} 
          />
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Content Warning */}
        {contentWarning && (
          <div className="px-4 pb-3">
            <Badge variant="destructive" className="text-xs">
              Content Warning: {contentWarning}
            </Badge>
          </div>
        )}
        
        {/* Images */}
        <div className={cn(
          "grid gap-1",
          images.length === 1 ? "grid-cols-1" : 
          images.length === 2 ? "grid-cols-2" :
          images.length === 3 ? "grid-cols-2" :
          "grid-cols-2"
        )}>
          {images.map((image, index) => (
            <div 
              key={index} 
              className={cn(
                "relative aspect-square overflow-hidden",
                images.length === 3 && index === 0 ? "row-span-2" : ""
              )}
            >
              <img
                src={image.url}
                alt={image.alt || title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
          ))}
        </div>
        
        {/* Post Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          {title && (
            <h3 className="font-semibold text-lg">{title}</h3>
          )}
          
          {/* Description */}
          {event.content && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.content}
            </p>
          )}
          
          {/* Location */}
          {(location || geohash) && (
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{location || `Geohash: ${geohash}`}</span>
            </div>
          )}
          
          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <Heart className="h-4 w-4" />
                <span className="text-xs">{likeCount}</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center space-x-1"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">{commentCount}</span>
              </Button>
              
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="text-xs">{zapCount}</span>
                {zapTotal > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({zapTotal} sats)
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Comments Section */}
        {showComments && (
          <CommentSection 
            eventId={event.id} 
            authorPubkey={event.pubkey}
          />
        )}
      </CardContent>
    </Card>
  );
}