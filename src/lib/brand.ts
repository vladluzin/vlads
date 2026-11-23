// Product naming lives in one place so the brand can be changed without touching prompts or UI.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Jyoti",
  assistantName: process.env.NEXT_PUBLIC_ASSISTANT_NAME ?? "Jyoti",
  tagline: "Vedic astrology, explained for your life",
};
