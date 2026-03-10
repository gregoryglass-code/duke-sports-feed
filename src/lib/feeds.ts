export interface FeedSource {
  name: string;
  url: string;
  dukeSpecific: boolean;
  category: "basketball" | "football" | "all-sports" | "conference";
}

export const FEED_SOURCES: FeedSource[] = [
  // Duke-specific feeds
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
  // Conference / league feeds (filtered for Duke content)
  {
    name: "ACC Official",
    url: "https://theacc.com/rss.aspx",
    dukeSpecific: false,
    category: "conference",
  },
  {
    name: "ESPN College Basketball",
    url: "https://www.espn.com/espn/rss/ncb/news",
    dukeSpecific: false,
    category: "basketball",
  },
  {
    name: "ESPN College Football",
    url: "https://www.espn.com/espn/rss/ncf/news",
    dukeSpecific: false,
    category: "football",
  },
  {
    name: "CBS Sports College Basketball",
    url: "https://www.cbssports.com/rss/headlines/college-basketball",
    dukeSpecific: false,
    category: "basketball",
  },
  {
    name: "NCAA DI Men's Basketball",
    url: "https://www.ncaa.com/news/basketball-men/d1/rss.xml",
    dukeSpecific: false,
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
