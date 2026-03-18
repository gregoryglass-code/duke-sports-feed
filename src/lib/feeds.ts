export interface FeedSource {
  name: string;
  url: string;
  dukeSpecific: boolean;
  category: "basketball" | "football" | "all-sports" | "conference";
  /** If true, links are Bing News redirects with real URL in ?url= param */
  bingNews?: boolean;
}

export const FEED_SOURCES: FeedSource[] = [
  // ── Bing News search (primary discovery — returns articles from all sources) ──
  {
    name: "Bing: Duke Basketball",
    url: "https://www.bing.com/news/search?q=Duke+Blue+Devils+basketball&format=rss&count=30",
    dukeSpecific: true,
    category: "basketball",
    bingNews: true,
  },
  {
    name: "Bing: Duke Football",
    url: "https://www.bing.com/news/search?q=Duke+Blue+Devils+football&format=rss&count=20",
    dukeSpecific: true,
    category: "football",
    bingNews: true,
  },
  {
    name: "Bing: Duke Sports",
    url: "https://www.bing.com/news/search?q=%22Duke+Blue+Devils%22+sports&format=rss&count=20",
    dukeSpecific: true,
    category: "all-sports",
    bingNews: true,
  },

  // ── Duke-specific blogs (insider depth) ──
  {
    name: "Duke Basketball Report",
    url: "https://www.dukebasketballreport.com/rss/index.xml",
    dukeSpecific: true,
    category: "basketball",
  },
  {
    name: "Ball Durham",
    url: "https://balldurham.com/feed/",
    dukeSpecific: true,
    category: "all-sports",
  },
  {
    name: "GoDuke.com Basketball",
    url: "https://goduke.com/rss.aspx?path=mbball",
    dukeSpecific: true,
    category: "basketball",
  },
];

export const DUKE_KEYWORDS = [
  "duke",
  "blue devils",
  "blue devil",
  "cameron indoor",
  "coach k",
  "jon scheyer",
  "wallace wade",
  "goduke",
  "duke university",
];
