/**
 * Zod schemas for Microsoft Graph API responses.
 * Provides runtime validation and TypeScript type inference.
 */

import { z } from 'zod';

// ============================================================================
// Common Types
// ============================================================================

export const EmailAddressSchema = z.object({
  name: z.string().optional(),
  address: z.string(),
});
export type EmailAddress = z.infer<typeof EmailAddressSchema>;

export const RecipientSchema = z.object({
  emailAddress: EmailAddressSchema,
});
export type Recipient = z.infer<typeof RecipientSchema>;

export const ItemBodySchema = z.object({
  contentType: z.enum(['text', 'html']).optional(),
  content: z.string(),
});
export type ItemBody = z.infer<typeof ItemBodySchema>;

export const DateTimeTimeZoneSchema = z.object({
  dateTime: z.string(),
  timeZone: z.string().optional(),
});
export type DateTimeTimeZone = z.infer<typeof DateTimeTimeZoneSchema>;

export const IdentitySchema = z.object({
  displayName: z.string().optional(),
  id: z.string().optional(),
  email: z.string().optional(),
});
export type Identity = z.infer<typeof IdentitySchema>;

export const IdentitySetSchema = z.object({
  user: IdentitySchema.optional(),
  application: IdentitySchema.optional(),
  device: IdentitySchema.optional(),
});
export type IdentitySet = z.infer<typeof IdentitySetSchema>;

// ============================================================================
// Outlook Mail Types
// ============================================================================

export const MessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  subject: z.string().optional(),
  bodyPreview: z.string().optional(),
  body: ItemBodySchema.optional(),
  importance: z.enum(['low', 'normal', 'high']).optional(),
  isRead: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  from: RecipientSchema.optional(),
  sender: RecipientSchema.optional(),
  toRecipients: z.array(RecipientSchema).optional(),
  ccRecipients: z.array(RecipientSchema).optional(),
  bccRecipients: z.array(RecipientSchema).optional(),
  replyTo: z.array(RecipientSchema).optional(),
  conversationId: z.string().optional(),
  webLink: z.string().optional(),
  categories: z.array(z.string()).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const MailFolderSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  parentFolderId: z.string().optional(),
  childFolderCount: z.number().optional(),
  unreadItemCount: z.number().optional(),
  totalItemCount: z.number().optional(),
});
export type MailFolder = z.infer<typeof MailFolderSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  isInline: z.boolean().optional(),
  lastModifiedDateTime: z.string().optional(),
  contentBytes: z.string().optional(), // Base64 encoded
});
export type Attachment = z.infer<typeof AttachmentSchema>;

// ============================================================================
// Calendar Types
// ============================================================================

export const LocationSchema = z.object({
  displayName: z.string().optional(),
  locationType: z.string().optional(),
  uniqueId: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    countryOrRegion: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
});
export type Location = z.infer<typeof LocationSchema>;

export const AttendeeSchema = z.object({
  emailAddress: EmailAddressSchema,
  type: z.enum(['required', 'optional', 'resource']).optional(),
  status: z.object({
    response: z.enum(['none', 'organizer', 'tentativelyAccepted', 'accepted', 'declined', 'notResponded']).optional(),
    time: z.string().optional(),
  }).optional(),
});
export type Attendee = z.infer<typeof AttendeeSchema>;

export const EventSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  subject: z.string().optional(),
  bodyPreview: z.string().optional(),
  body: ItemBodySchema.optional(),
  start: DateTimeTimeZoneSchema.optional(),
  end: DateTimeTimeZoneSchema.optional(),
  location: LocationSchema.optional(),
  locations: z.array(LocationSchema).optional(),
  attendees: z.array(AttendeeSchema).optional(),
  organizer: z.object({
    emailAddress: EmailAddressSchema,
  }).optional(),
  isAllDay: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
  isOrganizer: z.boolean().optional(),
  onlineMeeting: z.object({
    joinUrl: z.string().optional(),
  }).optional(),
  webLink: z.string().optional(),
  categories: z.array(z.string()).optional(),
});
export type Event = z.infer<typeof EventSchema>;

export const CalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  isDefaultCalendar: z.boolean().optional(),
  canShare: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  owner: EmailAddressSchema.optional(),
});
export type Calendar = z.infer<typeof CalendarSchema>;

// ============================================================================
// Teams Types
// ============================================================================

export const TeamSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  internalId: z.string().optional(),
  webUrl: z.string().optional(),
  isArchived: z.boolean().optional(),
});
export type Team = z.infer<typeof TeamSchema>;

export const ChannelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  email: z.string().optional(),
  webUrl: z.string().optional(),
  membershipType: z.enum(['standard', 'private', 'shared']).optional(),
  createdDateTime: z.string().optional(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  deletedDateTime: z.string().optional(),
  subject: z.string().optional(),
  body: ItemBodySchema.optional(),
  from: z.object({
    user: IdentitySchema.optional(),
    application: IdentitySchema.optional(),
  }).optional(),
  importance: z.enum(['normal', 'high', 'urgent']).optional(),
  webUrl: z.string().optional(),
  messageType: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string().optional(),
    contentType: z.string().optional(),
    name: z.string().optional(),
    contentUrl: z.string().optional(),
  })).optional(),
  mentions: z.array(z.object({
    id: z.number().optional(),
    mentionText: z.string().optional(),
    mentioned: IdentitySetSchema.optional(),
  })).optional(),
  reactions: z.array(z.object({
    reactionType: z.string(),
    createdDateTime: z.string().optional(),
    user: IdentitySetSchema.optional(),
  })).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSchema = z.object({
  id: z.string(),
  topic: z.string().optional(),
  chatType: z.enum(['oneOnOne', 'group', 'meeting']).optional(),
  createdDateTime: z.string().optional(),
  lastUpdatedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
});
export type Chat = z.infer<typeof ChatSchema>;

// ============================================================================
// SharePoint / OneDrive Types
// ============================================================================

export const DriveSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  driveType: z.enum(['personal', 'business', 'documentLibrary']).optional(),
  webUrl: z.string().optional(),
  owner: IdentitySetSchema.optional(),
  quota: z.object({
    used: z.number().optional(),
    remaining: z.number().optional(),
    total: z.number().optional(),
    deleted: z.number().optional(),
    state: z.string().optional(),
  }).optional(),
});
export type Drive = z.infer<typeof DriveSchema>;

export const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(),
  createdBy: IdentitySetSchema.optional(),
  lastModifiedBy: IdentitySetSchema.optional(),
  parentReference: z.object({
    driveId: z.string().optional(),
    id: z.string().optional(),
    path: z.string().optional(),
  }).optional(),
  file: z.object({
    mimeType: z.string().optional(),
    hashes: z.object({
      sha1Hash: z.string().optional(),
      quickXorHash: z.string().optional(),
    }).optional(),
  }).optional(),
  folder: z.object({
    childCount: z.number().optional(),
  }).optional(),
  '@microsoft.graph.downloadUrl': z.string().optional(),
});
export type DriveItem = z.infer<typeof DriveItemSchema>;

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  root: z.object({}).optional(),
  siteCollection: z.object({
    hostname: z.string().optional(),
    root: z.object({}).optional(),
  }).optional(),
});
export type Site = z.infer<typeof SiteSchema>;

export const ListSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  list: z.object({
    contentTypesEnabled: z.boolean().optional(),
    hidden: z.boolean().optional(),
    template: z.string().optional(),
  }).optional(),
});
export type List = z.infer<typeof ListSchema>;

// ============================================================================
// User Types
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  givenName: z.string().optional(),
  surname: z.string().optional(),
  mail: z.string().optional(),
  userPrincipalName: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  officeLocation: z.string().optional(),
  mobilePhone: z.string().optional(),
  businessPhones: z.array(z.string()).optional(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================================================
// OData Response Wrapper
// ============================================================================

export function createODataResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    '@odata.context': z.string().optional(),
    '@odata.count': z.number().optional(),
    '@odata.nextLink': z.string().optional(),
    value: z.array(itemSchema),
  });
}

export const MessageListResponseSchema = createODataResponseSchema(MessageSchema);
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>;

export const EventListResponseSchema = createODataResponseSchema(EventSchema);
export type EventListResponse = z.infer<typeof EventListResponseSchema>;

export const TeamListResponseSchema = createODataResponseSchema(TeamSchema);
export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

export const ChannelListResponseSchema = createODataResponseSchema(ChannelSchema);
export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>;

export const ChatMessageListResponseSchema = createODataResponseSchema(ChatMessageSchema);
export type ChatMessageListResponse = z.infer<typeof ChatMessageListResponseSchema>;

export const DriveItemListResponseSchema = createODataResponseSchema(DriveItemSchema);
export type DriveItemListResponse = z.infer<typeof DriveItemListResponseSchema>;

export const SiteListResponseSchema = createODataResponseSchema(SiteSchema);
export type SiteListResponse = z.infer<typeof SiteListResponseSchema>;
