import { get, post } from "../utils/request";

export type FeedbackReply = {
  id: number;
  role: "user" | "admin" | string;
  content: string;
  createdAt: string;
};

export type FeedbackTicket = {
  id: number;
  content: string;
  contact?: string;
  status: "open" | "closed" | string;
  lastRepliedAt?: string;
  lastReplierRole?: string;
  lastReplyPreview?: string;
  replyCount: number;
  createdAt: string;
  replies?: FeedbackReply[];
};

export type ListFeedbackResponse = {
  list: FeedbackTicket[];
  total: number;
  page: number;
  pageSize: number;
};

export const listFeedback = (params?: { page?: number; pageSize?: number }) =>
  get<ListFeedbackResponse>("/feedback", { params });

export const getFeedback = (id: number) => get<FeedbackTicket>(`/feedback/${id}`);

export const createFeedback = (body: { content: string; contact?: string }) =>
  post<FeedbackTicket>("/feedback", body);

export const replyFeedback = (id: number, content: string) =>
  post<FeedbackTicket>(`/feedback/${id}/replies`, { content });
