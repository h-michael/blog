export const SITE = {
  website: "https://h-michael.com/",
  author: "Hirokazu Hata",
  profile: "https://github.com/h-michael",
  desc: "忘れないうちに書き留める",
  title: "h-michael.com",
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 10,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "ja",
  timezone: "Asia/Tokyo",
} as const;
