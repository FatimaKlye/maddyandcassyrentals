export type AvailabilityLevel = "available" | "limited" | "full";

export interface UnitCounts {
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
}

export function getAvailabilityLevel(
  availableUnits: number,
  totalUnits: number
): AvailabilityLevel {
  if (availableUnits <= 0) return "full";
  const limitedThreshold = Math.max(1, Math.ceil(totalUnits * 0.3));
  if (availableUnits <= limitedThreshold) return "limited";
  return "available";
}

export function getAvailabilityLabel(level: AvailabilityLevel): string {
  switch (level) {
    case "available":
      return "Available";
    case "limited":
      return "Limited Units";
    case "full":
      return "Fully Booked";
  }
}

export function isFullyBooked(availableUnits: number): boolean {
  return availableUnits <= 0;
}

export function getUnitsAvailableText(availableUnits: number): string {
  return `${availableUnits} unit${availableUnits === 1 ? "" : "s"} available`;
}

export function getUnitsInUseText(totalUnits: number, availableUnits: number): string {
  const inUse = totalUnits - availableUnits;
  return `${inUse} of ${totalUnits} units currently rented or reserved`;
}

export function getFullyBookedMessage(totalUnits: number): string {
  return `All ${totalUnits} units are currently reserved.\nThank you for your interest. Please check back later for updated availability.`;
}
