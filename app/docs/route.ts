import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/openapi.json",
  theme: "kepler",
  metaData: {
    title: "BitPic API Documentation",
    description: "API documentation for BitPic - Your avatar on Bitcoin, forever",
  },
});
