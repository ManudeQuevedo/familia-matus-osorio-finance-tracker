const PHOTO_ID = "qqyUN78RmgI";
// From: plus.unsplash.com/premium_photo-1666874682074-0e0fdefd8f8a

type UnsplashPhotoResponse = {
  urls: { regular: string; full: string };
  user: { name: string; links: { html: string } };
  links: { html: string };
};

export type LoginBackground = {
  imageUrl: string;
  photographer: { name: string; profileUrl: string };
  photoPageUrl: string;
};

const UTM = "utm_source=noctra_finance&utm_medium=referral";

function withUtm(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${UTM}`;
}

export async function getLoginBackground(): Promise<LoginBackground | null> {
  const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn(
      "[unsplash] NEXT_PUBLIC_UNSPLASH_ACCESS_KEY is not set; login background skipped.",
    );
    return null;
  }

  const res = await fetch(`https://api.unsplash.com/photos/${PHOTO_ID}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    console.error("[unsplash] Failed to fetch photo:", res.status, res.statusText);
    return null;
  }

  const data = (await res.json()) as UnsplashPhotoResponse;

  return {
    imageUrl: data.urls.regular,
    photographer: {
      name: data.user.name,
      profileUrl: withUtm(data.user.links.html),
    },
    photoPageUrl: withUtm(data.links.html),
  };
}
