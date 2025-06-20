import { Heart, MessageCircle, Zap, Image, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { genUserName } from '@/lib/genUserName';
import type { NotificationEvent } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

interface NotificationItemProps {
  notification: NotificationEvent;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { event, targetEvent, type, created_at } = notification;
  const author = useAuthor(event.pubkey);
  const { isRead, markAsRead } = useNotificationContext();
  const navigate = useNavigate();
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(event.pubkey);
  const profileImage = metadata?.picture;
  const isNotificationRead = isRead(notification.id);

  const handleClick = () => {
    if (!isNotificationRead) {
      markAsRead(notification.id);
    }
    
    // Navigate to the target post if available
    if (targetEvent) {
      const nevent = nip19.neventEncode({
        id: targetEvent.id,
        author: targetEvent.pubkey,
      });
      navigate(`/${nevent}`);
    }
  };

  const getNotificationIcon = () => {
    switch (type) {
      case 'reaction':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'zap':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getNotificationText = () => {
    const postText = targetEvent ? 'your post' : 'your content';
    
    switch (type) {
      case 'reaction': {
        const reactionContent = event.content || '+';
        return `reacted ${reactionContent} to ${postText}`;
      }
      case 'comment':
        return `commented on ${postText}`;
      case 'zap': {
        const amountTag = event.tags.find(tag => tag[0] === 'amount');
        const amount = amountTag ? parseInt(amountTag[1]) : 0;
        const sats = Math.floor(amount / 1000);
        return `zapped ${sats > 0 ? `${sats} sats to` : ''} ${postText}`;
      }
      default:
        return `interacted with ${postText}`;
    }
  };

  const getTargetPostIcon = () => {
    if (!targetEvent) return null;
    
    if (targetEvent.kind === 20) {
      return <Image className="h-3 w-3 text-muted-foreground" />;
    } else if ([22, 34236].includes(targetEvent.kind)) {
      return <Video className="h-3 w-3 text-muted-foreground" />;
    }
    return null;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return `${Math.floor(diff / 604800)}w`;
  };

  return (
    <Button
      variant="ghost"
      className={`w-full p-3 h-auto justify-start hover:bg-muted/50 ${
        !isNotificationRead ? 'bg-muted/30' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-3 w-full">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
            {getNotificationIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm truncate">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground">
              {getNotificationText()}
            </span>
            {!isNotificationRead && (
              <Badge variant="destructive" className="h-2 w-2 rounded-full p-0" />
            )}
          </div>
          
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(created_at)}
            </span>
            {getTargetPostIcon()}
          </div>
          
          {type === 'comment' && event.content && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              "{event.content.slice(0, 100)}{event.content.length > 100 ? '...' : ''}"
            </p>
          )}
        </div>
      </div>
    </Button>
  );
}