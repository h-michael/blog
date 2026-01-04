import type { Props } from "astro";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconRss from "@/assets/icons/IconRss.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconMastodon from "@/assets/icons/IconMastodon.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconTelegram from "@/assets/icons/IconTelegram.svg";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

export const SOCIALS: Social[] = [
  {
    name: "RSS",
    href: "/rss.xml",
    linkTitle: "RSS Feed",
    icon: IconRss,
  },
  {
    name: "GitHub",
    href: "https://github.com/h-michael",
    linkTitle: `${SITE.author} on GitHub`,
    icon: IconGitHub,
  },
  {
    name: "X",
    href: "https://twitter.com/h_michael_z",
    linkTitle: `${SITE.author} on X`,
    icon: IconBrandX,
  },
  {
    name: "Mastodon",
    href: "https://mstdn.jp/@h_micheal",
    linkTitle: `${SITE.author} on Mastodon`,
    icon: IconMastodon,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/hirokazu-h-18778a84/",
    linkTitle: `${SITE.author} on LinkedIn`,
    icon: IconLinkedin,
  },
] as const;

export const SHARE_LINKS: Social[] = [
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: `Share this post on X`,
    icon: IconBrandX,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: `Share this post on Facebook`,
    icon: IconFacebook,
  },
  {
    name: "Telegram",
    href: "https://t.me/share/url?url=",
    linkTitle: `Share this post via Telegram`,
    icon: IconTelegram,
  },
] as const;
