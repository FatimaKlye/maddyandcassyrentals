import type { Product, ProductReview } from "@/types/product";

const phoneIncluded: string[] = [
  "Original charger & USB-C cable",
  "Protective case",
  "Screen protector (pre-installed)",
  "SIM ejector tool",
];

const cameraIncluded: string[] = [
  "Camera body & battery",
  "Charging cable",
  "64GB memory card",
  "Carrying pouch",
];

function reviews(entries: Omit<ProductReview, "id">[], productId: string): ProductReview[] {
  return entries.map((entry, index) => ({ id: `${productId}-review-${index + 1}`, ...entry }));
}

export const products: Product[] = [
  // Phones
  {
    id: "iphone-17-pro-max",
    name: "iPhone 17 Pro Max",
    brand: "Apple",
    category: "Phones",
    description:
      "The latest flagship iPhone with the biggest display, pro camera system, and all-day battery life. Perfect for travel vlogging and high-end content creation.",
    pricePerDay: 2000,
    depositAmount: 6000,
    currency: "₱",
    image: "/images/products/iphone-17-pro-max.svg",
    badge: "New",
    totalUnits: 4,
    availableUnits: 4,
    reservedUnits: 0,
    rentedUnits: 0,
    rating: 4.9,
    reviewCount: 21,
    specs: {
      Display: "6.9\" Super Retina XDR OLED, 120Hz",
      Chip: "A19 Pro",
      Storage: "256GB",
      Camera: "48MP Triple camera system with 5x telephoto",
      Battery: "Up to 33 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Marga T.", rating: 5, comment: "Battery lasted the whole shoot day, camera quality is unreal.", date: "2026-06-02" },
        { author: "Ken D.", rating: 5, comment: "Pickup was smooth and the unit was spotless.", date: "2026-05-18" },
        { author: "Ivy R.", rating: 4, comment: "Great phone, wish the deposit was a bit lower.", date: "2026-04-30" },
      ],
      "iphone-17-pro-max"
    ),
  },
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    brand: "Apple",
    category: "Phones",
    description:
      "Compact pro power with a titanium build, advanced camera system, and blazing performance for creators on the move.",
    pricePerDay: 1700,
    depositAmount: 5000,
    currency: "₱",
    image: "/images/products/iphone-17-pro.svg",
    badge: "New",
    totalUnits: 5,
    availableUnits: 1,
    reservedUnits: 3,
    rentedUnits: 1,
    rating: 4.8,
    reviewCount: 14,
    specs: {
      Display: "6.3\" Super Retina XDR OLED, 120Hz",
      Chip: "A19 Pro",
      Storage: "256GB",
      Camera: "48MP Triple camera system",
      Battery: "Up to 27 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Paolo S.", rating: 5, comment: "Rented for a wedding shoot, footage looked amazing.", date: "2026-05-10" },
        { author: "Nica V.", rating: 5, comment: "Compact size but still very powerful.", date: "2026-04-22" },
      ],
      "iphone-17-pro"
    ),
  },
  {
    id: "iphone-16-pro-max",
    name: "iPhone 16 Pro Max",
    brand: "Apple",
    category: "Phones",
    description:
      "A large-screen pro iPhone with a versatile triple-camera setup, ideal for photography, filming, and everyday productivity.",
    pricePerDay: 1500,
    depositAmount: 4500,
    currency: "₱",
    image: "/images/products/iphone-16-pro-max.svg",
    totalUnits: 6,
    availableUnits: 0,
    reservedUnits: 4,
    rentedUnits: 2,
    rating: 4.7,
    reviewCount: 30,
    specs: {
      Display: "6.9\" Super Retina XDR OLED, 120Hz",
      Chip: "A18 Pro",
      Storage: "256GB",
      Camera: "48MP Triple camera system with 5x telephoto",
      Battery: "Up to 33 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Diego M.", rating: 5, comment: "One of our go-to rentals for client shoots.", date: "2026-03-14" },
        { author: "Sam L.", rating: 4, comment: "Great phone, book early since it's popular.", date: "2026-02-27" },
        { author: "Trisha A.", rating: 5, comment: "Camera stabilization is fantastic for reels.", date: "2026-02-02" },
      ],
      "iphone-16-pro-max"
    ),
  },
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    brand: "Apple",
    category: "Phones",
    description:
      "Pro-grade cameras and performance in a comfortable size, great for shoots, events, and daily use.",
    pricePerDay: 1300,
    depositAmount: 4000,
    currency: "₱",
    image: "/images/products/iphone-16-pro.svg",
    totalUnits: 6,
    availableUnits: 5,
    reservedUnits: 1,
    rentedUnits: 0,
    rating: 4.7,
    reviewCount: 18,
    specs: {
      Display: "6.3\" Super Retina XDR OLED, 120Hz",
      Chip: "A18 Pro",
      Storage: "128GB",
      Camera: "48MP Triple camera system",
      Battery: "Up to 27 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Bea C.", rating: 5, comment: "Perfect size for one-handed vlogging.", date: "2026-04-05" },
        { author: "Ronan P.", rating: 4, comment: "Solid rental, arrived fully charged.", date: "2026-03-19" },
      ],
      "iphone-16-pro"
    ),
  },
  {
    id: "iphone-16",
    name: "iPhone 16",
    brand: "Apple",
    category: "Phones",
    description:
      "A reliable, well-rounded iPhone with a great camera and smooth performance for everyday rental needs.",
    pricePerDay: 1000,
    depositAmount: 3000,
    currency: "₱",
    image: "/images/products/iphone-16.svg",
    totalUnits: 8,
    availableUnits: 6,
    reservedUnits: 2,
    rentedUnits: 0,
    rating: 4.6,
    reviewCount: 24,
    specs: {
      Display: "6.1\" Super Retina XDR OLED, 60Hz",
      Chip: "A18",
      Storage: "128GB",
      Camera: "48MP Dual camera system",
      Battery: "Up to 22 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Carla J.", rating: 5, comment: "Best value pick for a weekend trip.", date: "2026-03-30" },
        { author: "Miguel F.", rating: 4, comment: "Battery life held up all day.", date: "2026-03-01" },
      ],
      "iphone-16"
    ),
  },
  {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    brand: "Apple",
    category: "Phones",
    description:
      "Titanium design with a powerful zoom camera system, well suited for events, travel, and professional shoots.",
    pricePerDay: 1200,
    depositAmount: 3600,
    currency: "₱",
    image: "/images/products/iphone-15-pro-max.svg",
    totalUnits: 6,
    availableUnits: 4,
    reservedUnits: 2,
    rentedUnits: 0,
    rating: 4.6,
    reviewCount: 27,
    specs: {
      Display: "6.7\" Super Retina XDR OLED, 120Hz",
      Chip: "A17 Pro",
      Storage: "256GB",
      Camera: "48MP Triple camera system with 5x telephoto",
      Battery: "Up to 29 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Wendy O.", rating: 5, comment: "Zoom lens made our event coverage so much easier.", date: "2026-02-14" },
        { author: "Aldrin V.", rating: 4, comment: "Great titanium build, feels premium.", date: "2026-01-28" },
      ],
      "iphone-15-pro-max"
    ),
  },
  {
    id: "iphone-15",
    name: "iPhone 15",
    brand: "Apple",
    category: "Phones",
    description:
      "A dependable everyday iPhone with Dynamic Island and a sharp main camera, great value for short rentals.",
    pricePerDay: 700,
    depositAmount: 2100,
    currency: "₱",
    image: "/images/products/iphone-15.svg",
    totalUnits: 8,
    availableUnits: 7,
    reservedUnits: 1,
    rentedUnits: 0,
    rating: 4.5,
    reviewCount: 19,
    specs: {
      Display: "6.1\" Super Retina XDR OLED, 60Hz",
      Chip: "A16 Bionic",
      Storage: "128GB",
      Camera: "48MP Dual camera system",
      Battery: "Up to 20 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Jinky S.", rating: 4, comment: "Reliable backup phone for our shoot.", date: "2026-01-15" },
        { author: "Marco T.", rating: 5, comment: "Great condition, no scratches at all.", date: "2025-12-20" },
      ],
      "iphone-15"
    ),
  },
  {
    id: "iphone-14-pro-max",
    name: "iPhone 14 Pro Max",
    brand: "Apple",
    category: "Phones",
    description:
      "A spacious display and Pro camera system with Always-On Display, ideal for content and business use.",
    pricePerDay: 900,
    depositAmount: 2700,
    currency: "₱",
    image: "/images/products/iphone-14-pro-max.svg",
    totalUnits: 5,
    availableUnits: 5,
    reservedUnits: 0,
    rentedUnits: 0,
    rating: 4.5,
    reviewCount: 16,
    specs: {
      Display: "6.7\" Super Retina XDR OLED, 120Hz",
      Chip: "A16 Bionic",
      Storage: "128GB",
      Camera: "48MP Triple camera system",
      Battery: "Up to 29 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Hazel N.", rating: 5, comment: "Always-On Display is such a nice touch.", date: "2025-12-05" },
        { author: "Ferdie L.", rating: 4, comment: "Great budget pro option.", date: "2025-11-22" },
      ],
      "iphone-14-pro-max"
    ),
  },
  {
    id: "iphone-13-pro-max",
    name: "iPhone 13 Pro Max",
    brand: "Apple",
    category: "Phones",
    description:
      "Large display and excellent low-light camera performance, a strong budget-friendly pro option.",
    pricePerDay: 800,
    depositAmount: 2400,
    currency: "₱",
    image: "/images/products/iphone-13-pro-max.svg",
    totalUnits: 5,
    availableUnits: 3,
    reservedUnits: 2,
    rentedUnits: 0,
    rating: 4.4,
    reviewCount: 22,
    specs: {
      Display: "6.7\" Super Retina XDR OLED, 120Hz",
      Chip: "A15 Bionic",
      Storage: "128GB",
      Camera: "12MP Triple camera system",
      Battery: "Up to 28 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Nikki B.", rating: 4, comment: "Still holds up really well for the price.", date: "2025-11-10" },
        { author: "Oscar M.", rating: 5, comment: "Low-light shots came out clean.", date: "2025-10-29" },
      ],
      "iphone-13-pro-max"
    ),
  },
  {
    id: "iphone-13-pro",
    name: "iPhone 13 Pro",
    brand: "Apple",
    category: "Phones",
    description:
      "Compact pro camera system with ProRAW support, a solid choice for everyday rentals.",
    pricePerDay: 600,
    depositAmount: 1800,
    currency: "₱",
    image: "/images/products/iphone-13-pro.svg",
    totalUnits: 6,
    availableUnits: 6,
    reservedUnits: 0,
    rentedUnits: 0,
    rating: 4.4,
    reviewCount: 12,
    specs: {
      Display: "6.1\" Super Retina XDR OLED, 120Hz",
      Chip: "A15 Bionic",
      Storage: "128GB",
      Camera: "12MP Triple camera system with ProRAW",
      Battery: "Up to 22 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Grace P.", rating: 4, comment: "Good all-around performer for the price.", date: "2025-10-12" },
        { author: "Julius R.", rating: 5, comment: "ProRAW files were great for editing.", date: "2025-09-30" },
      ],
      "iphone-13-pro"
    ),
  },
  {
    id: "iphone-xr",
    name: "iPhone XR",
    brand: "Apple",
    category: "Phones",
    description:
      "An affordable, dependable iPhone perfect for calls, basic photography, and short-term backup use.",
    pricePerDay: 350,
    depositAmount: 1000,
    currency: "₱",
    image: "/images/products/iphone-xr.svg",
    totalUnits: 10,
    availableUnits: 8,
    reservedUnits: 2,
    rentedUnits: 0,
    rating: 4.2,
    reviewCount: 15,
    specs: {
      Display: "6.1\" Liquid Retina LCD, 60Hz",
      Chip: "A12 Bionic",
      Storage: "64GB",
      Camera: "12MP Single camera",
      Battery: "Up to 16 hours video playback",
    },
    included: phoneIncluded,
    reviews: reviews(
      [
        { author: "Lorna D.", rating: 4, comment: "Perfect cheap backup phone for the event.", date: "2025-09-05" },
        { author: "Emman T.", rating: 4, comment: "Does what it needs to do, good value.", date: "2025-08-19" },
      ],
      "iphone-xr"
    ),
  },

  // Cameras
  {
    id: "dji-osmo-action-6",
    name: "DJI Osmo Action 6",
    brand: "DJI",
    category: "Cameras",
    description:
      "A rugged action camera built for adventure, with stabilized 4K footage that thrives in extreme conditions.",
    pricePerDay: 500,
    depositAmount: 1500,
    currency: "₱",
    image: "/images/products/dji-osmo-action-6.svg",
    badge: "Popular",
    totalUnits: 5,
    availableUnits: 3,
    reservedUnits: 2,
    rentedUnits: 0,
    rating: 4.8,
    reviewCount: 33,
    specs: {
      Sensor: "1/1.3\" CMOS",
      Resolution: "4K/120fps video, 50MP photo",
      Lens: "Wide-angle f/2.8",
      Stabilization: "HorizonSteady + RockSteady 3.0",
      Battery: "Up to 160 minutes recording",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Rico A.", rating: 5, comment: "Survived a whole day at the falls, footage is buttery smooth.", date: "2026-05-20" },
        { author: "Steph K.", rating: 5, comment: "Loved the horizon leveling for surf clips.", date: "2026-04-11" },
      ],
      "dji-osmo-action-6"
    ),
  },
  {
    id: "dji-osmo-pocket-3",
    name: "DJI Osmo Pocket 3",
    brand: "DJI",
    category: "Cameras",
    description:
      "A pocket-sized gimbal camera with a rotating touchscreen, perfect for smooth handheld vlogging.",
    pricePerDay: 450,
    depositAmount: 1350,
    currency: "₱",
    image: "/images/products/dji-osmo-pocket-3.svg",
    totalUnits: 4,
    availableUnits: 1,
    reservedUnits: 2,
    rentedUnits: 1,
    rating: 4.9,
    reviewCount: 28,
    specs: {
      Sensor: "1\" CMOS",
      Resolution: "4K/120fps video, 20MP photo",
      Lens: "f/2.0 fixed",
      Stabilization: "3-axis mechanical gimbal",
      Battery: "Up to 166 minutes recording",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Tin M.", rating: 5, comment: "Gimbal footage looks incredibly cinematic.", date: "2026-05-02" },
        { author: "Andre L.", rating: 5, comment: "Fits in a pocket and the screen flips for selfies.", date: "2026-03-25" },
      ],
      "dji-osmo-pocket-3"
    ),
  },
  {
    id: "insta360-x5",
    name: "Insta360 X5",
    brand: "Insta360",
    category: "Cameras",
    description:
      "A dual-lens 360° camera that captures immersive footage and reframes shots after filming.",
    pricePerDay: 500,
    depositAmount: 1500,
    currency: "₱",
    image: "/images/products/insta360-x5.svg",
    totalUnits: 4,
    availableUnits: 4,
    reservedUnits: 0,
    rentedUnits: 0,
    rating: 4.7,
    reviewCount: 20,
    specs: {
      Sensor: "Dual 1/1.28\" CMOS",
      Resolution: "8K30 360° video, 72MP photo",
      Lens: "Dual fisheye",
      Stabilization: "FlowState stabilization",
      Battery: "Up to 135 minutes recording",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Cathy Y.", rating: 5, comment: "Reframing shots after the shoot saved us so much time.", date: "2026-02-18" },
        { author: "Bogs R.", rating: 4, comment: "Great for immersive event coverage.", date: "2026-01-30" },
      ],
      "insta360-x5"
    ),
  },
  {
    id: "canon-g7x-mark-iii",
    name: "Canon G7X Mark III",
    brand: "Canon",
    category: "Cameras",
    description:
      "A creator favorite compact camera with a bright lens and flip screen, ideal for vlogging and livestreaming.",
    pricePerDay: 600,
    depositAmount: 1800,
    currency: "₱",
    image: "/images/products/canon-g7x-mark-iii.svg",
    totalUnits: 5,
    availableUnits: 0,
    reservedUnits: 3,
    rentedUnits: 2,
    rating: 4.6,
    reviewCount: 26,
    specs: {
      Sensor: "1\" CMOS",
      Resolution: "4K/30fps video, 20.1MP photo",
      Lens: "24-100mm f/1.8-2.8",
      Stabilization: "Optical Image Stabilizer",
      Battery: "Up to 90 minutes recording",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Neil C.", rating: 5, comment: "The vlogging classic for a reason, bright lens indoors.", date: "2026-01-08" },
        { author: "Pam G.", rating: 4, comment: "Book ahead, this one is always in demand.", date: "2025-12-14" },
      ],
      "canon-g7x-mark-iii"
    ),
  },
  {
    id: "fujifilm-xt100",
    name: "Fujifilm X-T100",
    brand: "Fujifilm",
    category: "Cameras",
    description:
      "A mirrorless camera with signature Fujifilm color science, great for photography with a classic look.",
    pricePerDay: 500,
    depositAmount: 1500,
    currency: "₱",
    image: "/images/products/fujifilm-xt100.svg",
    totalUnits: 4,
    availableUnits: 3,
    reservedUnits: 1,
    rentedUnits: 0,
    rating: 4.5,
    reviewCount: 17,
    specs: {
      Sensor: "APS-C CMOS III, 24.2MP",
      Resolution: "4K/15fps video, 24.2MP photo",
      Lens: "Interchangeable X-mount",
      Stabilization: "Digital stabilization",
      Battery: "Up to 430 shots per charge",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Mikee S.", rating: 5, comment: "Colors straight out of camera are gorgeous.", date: "2025-12-01" },
        { author: "Gio F.", rating: 4, comment: "Great for a photography-focused shoot day.", date: "2025-11-15" },
      ],
      "fujifilm-xt100"
    ),
  },
  {
    id: "samsung-nx-mini",
    name: "Samsung NX Mini",
    brand: "Samsung",
    category: "Cameras",
    description:
      "An ultra-compact mirrorless camera that's light on the hands and easy to carry for casual shoots.",
    pricePerDay: 350,
    depositAmount: 1000,
    currency: "₱",
    image: "/images/products/samsung-nx-mini.svg",
    totalUnits: 5,
    availableUnits: 5,
    reservedUnits: 0,
    rentedUnits: 0,
    rating: 4.2,
    reviewCount: 9,
    specs: {
      Sensor: "1\" BSI CMOS, 20.5MP",
      Resolution: "1080p video, 20.5MP photo",
      Lens: "Interchangeable NX-M mount",
      Stabilization: "Digital stabilization",
      Battery: "Up to 240 shots per charge",
    },
    included: cameraIncluded,
    reviews: reviews(
      [
        { author: "Deng V.", rating: 4, comment: "Super light and easy to carry all day.", date: "2025-10-22" },
        { author: "Cha L.", rating: 4, comment: "Good starter camera for casual shoots.", date: "2025-09-28" },
      ],
      "samsung-nx-mini"
    ),
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}
