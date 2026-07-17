import { Bloom, EffectComposer } from "@react-three/postprocessing";

interface CinematicBloomProps {
  profile: "desktop" | "tablet" | "mobile";
  variant: "cosmic" | "world";
}

export default function CinematicBloom({ profile, variant }: CinematicBloomProps) {
  const resolutionScale = profile === "mobile" ? 0.68 : profile === "tablet" ? 0.84 : 1;

  return (
    <EffectComposer multisampling={0} resolutionScale={resolutionScale}>
      {variant === "cosmic" ? (
        <Bloom intensity={0.74} luminanceThreshold={0.13} luminanceSmoothing={0.88} mipmapBlur />
      ) : (
        <Bloom intensity={0.72} luminanceThreshold={0.42} mipmapBlur radius={0.52} />
      )}
    </EffectComposer>
  );
}
