export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
};

export type Barber = {
  id: string;
  name: string;
  role: string;
  specialties: string;
  image: string;
};

export const services: Service[] = [
  {
    id: "corte-clasico",
    name: "Corte clásico",
    description: "Diagnóstico, corte personalizado y acabado con producto.",
    price: 50,
    duration: 40,
    category: "Corte",
  },
  {
    id: "corte-barba",
    name: "Corte + barba",
    description: "Servicio completo con perfilado, toalla caliente y acabado.",
    price: 80,
    duration: 60,
    category: "Completo",
  },
  {
    id: "barba-premium",
    name: "Barba premium",
    description: "Diseño de barba, afeitado de contornos y cuidado hidratante.",
    price: 40,
    duration: 30,
    category: "Barba",
  },
  {
    id: "corte-infantil",
    name: "Corte infantil",
    description: "Atención paciente y cómoda para niños de hasta 12 años.",
    price: 40,
    duration: 35,
    category: "Infantil",
  },
];

export const barbers: Barber[] = [
  {
    id: "mateo",
    name: "Mateo Vargas",
    role: "Barbero senior",
    specialties: "Fades, cortes clásicos y barba",
    image: "https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "lucas",
    name: "Lucas Rojas",
    role: "Estilista",
    specialties: "Texturas, color y estilos modernos",
    image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "sofia",
    name: "Sofía Molina",
    role: "Estilista senior",
    specialties: "Cortes largos, color y asesoría de imagen",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=85",
  },
];

export const gallery = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85",
];
