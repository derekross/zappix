import { memo, useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/useToast";
import { encode as encodeGeohash } from "ngeohash";

interface LocationPickerProps {
  location: string;
  geohash: string;
  onLocationChange: (location: string, geohash: string) => void;
  dialogOpen: boolean;
}

export const LocationPicker = memo(function LocationPicker({
  location,
  geohash,
  onLocationChange,
  dialogOpen,
}: LocationPickerProps) {
  const [autoLocation, setAutoLocation] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();

  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        }
      );

      const { latitude, longitude } = position.coords;
      const hash = encodeGeohash(latitude, longitude, 7);

      // Reverse geocode to get location name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
        );
        const data = (await response.json()) as {
          address: {
            city?: string;
            state?: string;
            country?: string;
          };
        };

        const locationParts: string[] = [];
        if (data.address.city) locationParts.push(data.address.city);
        if (data.address.state) locationParts.push(data.address.state);
        if (data.address.country) locationParts.push(data.address.country);

        onLocationChange(locationParts.join(", "), hash);
      } catch {
        onLocationChange(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, hash);
      }

      toast({
        title: "Location found!",
        description: "Your location has been added to the post",
      });
    } catch {
      toast({
        title: "Location error",
        description: "Could not get your location. Please try again or enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  }, [toast, onLocationChange]);

  useEffect(() => {
    if (autoLocation && dialogOpen && !location && !isGettingLocation) {
      getLocation();
    }
  }, [autoLocation, dialogOpen, location, isGettingLocation, getLocation]);

  const handleToggle = (checked: boolean) => {
    setAutoLocation(checked);
    if (checked && !location && !isGettingLocation) {
      getLocation();
    } else if (!checked) {
      onLocationChange("", "");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Location</Label>
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-location"
            checked={autoLocation}
            onCheckedChange={handleToggle}
          />
          <Label htmlFor="auto-location" className="text-sm">
            Include location
          </Label>
        </div>
      </div>
      {autoLocation && (
        <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
          {isGettingLocation ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Detecting location...</span>
            </>
          ) : location ? (
            <>
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm">{location}</span>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Location will be detected automatically</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
