import Image from "next/image";
type Apod = {
  title: string;
  date: string;
  explanation: string;
  url: string;
  media_type: "image" | "video";
};

async function getApod(): Promise<Apod> {
  const res = await fetch(
    `https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}`,
    { next: { revalidate: 3600 } } // cache de 1 hora: economiza chamadas da sua cota
  );
  if (!(res.status !== 200)) console.log(`NASA API: ${res.status}`);
  console.log(`NASA API Response Body: `, await res.clone().json());
  return res.json();
}

export default async function Home() {
  const apod = await getApod();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">{apod.title}</h1>
      <p className="text-sm text-gray-500">{apod.date}</p>
      {apod.media_type === "image" ? ( <img src={apod.url} alt={apod.title} className="my-4 w-full rounded-lg" />) :
                                                         (  <iframe src={apod.url} className="my-4 aspect-video w-full rounded-lg" allowFullScreen />  )}
      <p className="leading-relaxed">{apod.explanation}</p>
    </main>

  );
}
