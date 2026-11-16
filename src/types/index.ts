/**
 * NoChat v4 - TypeScript Type Definitions
 */

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  bio?: string;
  role?: string;
  profilePicture?: string | null;
  isVerified: boolean;
  verifiedUntil?: string | null;
  verifiedBadge?: boolean;
  memberNumber: number;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  subscribersCount?: number;
  isSubscribed?: boolean;
  createdAt: string;
  status?: 'active' | 'suspended' | 'banned' | 'deleted';
  soundEnabled?: boolean;
}

export interface Post {
  id: string;
  userId: string;
  user?: User;
  imageUrl?: string;
  videoUrl?: string;
  mediaUrl?: string;
  caption?: string;
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  createdAt: string;
}

export interface Reel {
  id: string;
  userId: string;
  user?: User;
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  audioTitle?: string;
  likes?: string[];
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  createdAt: string;
}

export interface MessageReaction {
  [emoji: string]: string[]; // array of userIds
}

export interface MessageReply {
  id: string;
  text: string;
  senderUsername: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName?: string;
  isVerified?: boolean;
  text: string;
  replyTo?: MessageReply;
  reactions?: MessageReaction;
  sharedReel?: {
    id: string;
    caption: string;
    videoUrl: string;
    thumbnail?: string | null;
    creatorUsername: string;
    creatorDisplayName: string;
  };
  attachment?: {
    url: string;
    name: string;
    size: number;
    type: string;
  };
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
  deletedAt?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  members: string[];
  otherUser?: User;
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
}

export interface VideoItem {
  id: string;
  category: 'Full Movies' | 'Anime' | 'Trailers' | 'Entertainment' | string;
  provider: 'youtube' | 'vimeo';
  embedId: string;
  title: string;
  channel: string;
  duration?: string;
  rating?: string;
  streamPlatforms?: string[];
  isFullMovie?: boolean;
  description?: string;
  views?: number;
}

export interface Announcement {
  id: string;
  kind: 'announcement';
  title: string;
  message: string;
  createdAt: string;
  dismissed?: boolean;
}
