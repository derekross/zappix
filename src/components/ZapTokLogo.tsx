interface ZapTokLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  onClick?: () => void;
}

export function ZapTokLogo({ 
  className = "", 
  size = 24, 
  showText = true, 
  onClick 
}: ZapTokLogoProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer ${className}`}
    >
      <img 
        src="/zaptok-logo.svg" 
        alt="ZapTok" 
        width={size} 
        height={size}
        className="flex-shrink-0"
      />
      {showText && (
        <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          ZapTok
        </h1>
      )}
    </button>
  );
}
