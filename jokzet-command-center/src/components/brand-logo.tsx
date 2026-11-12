import Image from "next/image";

/** JOKZET Labs logo mark (white on transparent). Source: user-supplied logo, unaltered artwork. */
export function BrandLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="JOKZET Labs"
      width={512}
      height={512}
      priority
      className={`${className} shrink-0 object-contain`}
    />
  );
}
