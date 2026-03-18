import type { FeedItem } from "./aggregator";

export interface Story {
  id: string;
  headline: string;
  summary: string;
  keyPoints: string[];
  category: FeedItem["category"];
  articles: FeedItem[];
  sourceCount: number;
  latestDate: string;
  imageUrl: string | null;
  relatedStoryIds: string[];
}

export interface StoryFeed {
  stories: Story[];
  unclustered: FeedItem[];
  sources: { name: string; status: "ok" | "error"; count: number }[];
  lastUpdated: string;
}
