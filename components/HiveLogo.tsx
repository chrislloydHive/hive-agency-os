export default function HiveLogo({ className = "h-9 w-auto" }: { className?: string }) {
  // Using the yellow logo for dark backgrounds
  // Switch to "/HiveLogo-Wht.png" if you prefer white on dark
  return (
    <img
      src="/HiveLogo-Ylw.png"
      alt="hive"
      className={className}
    />
  );
}

