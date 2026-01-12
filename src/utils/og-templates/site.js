import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

export default async () => {
  return satori(
    {
      type: "div",
      props: {
        style: {
          background: "#fafafa",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
        },
        children: {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    textAlign: "center",
                  },
                  children: [
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: 72,
                          fontWeight: "bold",
                          color: "#18181b",
                          marginBottom: "20px",
                          fontFamily: '"Noto Sans JP", "IBM Plex Mono"',
                        },
                        children: SITE.title,
                      },
                    },
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: 28,
                          color: "#18181b",
                          fontFamily: '"Noto Sans JP", "IBM Plex Mono"',
                        },
                        children: SITE.desc,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    width: "100%",
                  },
                  children: {
                    type: "span",
                    props: {
                      style: {
                        fontSize: 28,
                        fontWeight: "bold",
                        color: "#18181b",
                      },
                      children: new URL(SITE.website).hostname,
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(SITE.title + SITE.desc + SITE.website),
    }
  );
};
