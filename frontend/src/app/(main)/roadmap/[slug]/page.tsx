"use client";

import { RoadmapView } from "@/components/roadmap/RoadmapView";

export default function RoadmapPage({ params }: { params: { slug: string } }) {
  return <RoadmapView slug={params.slug} />;
}
