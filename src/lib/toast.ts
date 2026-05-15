import type { ReactNode } from "react";
import { toast } from "sonner";

type ToastRegistryHandlers = {
  refreshSession: () => Promise<void>;
  openAccountsSettings: () => void;
};

let registry: ToastRegistryHandlers = {
  refreshSession: async () => {},
  openAccountsSettings: () => {},
};

/** Call from authenticated shell to wire Supabase/session + settings modal. */
export function bindToastRegistry(next: ToastRegistryHandlers) {
  registry = next;
}

export function resetToastRegistry() {
  registry = {
    refreshSession: async () => {},
    openAccountsSettings: () => {},
  };
}

/** Translated destructive confirmation (toast replaces `window.confirm`). */
export function toastConfirmDestructive(opts: {
  title: ReactNode;
  description?: string;
  duration?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  toast.warning(opts.title, {
    description:
      opts.description ??
      "Esta acción no se puede deshacer. ¿Seguro que deseas continuar?",
    duration: opts.duration ?? 8000,
    action: {
      label: opts.confirmLabel ?? "Eliminar",
      onClick: () => {
        void Promise.resolve(opts.onConfirm());
      },
    },
    cancel: {
      label: opts.cancelLabel ?? "Cancelar",
      onClick: () => {},
    },
  });
}

export const notify = {
  auth: {
    loginSuccess: () =>
      toast.success("¡Bienvenido de vuelta!", {
        description: "Tu sesión ha iniciado correctamente.",
      }),
    loginError: () =>
      toast.error("No pudimos iniciar sesión", {
        description:
          "Verifica tu correo y contraseña e intenta de nuevo.",
      }),
    loginUnauthorized: () =>
      toast.error("Acceso no permitido", {
        description: "Este correo no tiene acceso a la app.",
      }),
    logoutSuccess: () =>
      toast.success("Sesión cerrada", {
        description: "Hasta pronto.",
      }),
    sessionExpired: () =>
      toast.warning("Tu sesión expiró", {
        description: "Por seguridad, inicia sesión de nuevo.",
        duration: 6000,
      }),
    sessionExpiring: () =>
      toast.warning("Tu sesión expira pronto", {
        description: "Tu sesión cerrará en 5 minutos.",
        duration: 8000,
        action: {
          label: "Mantener sesión",
          onClick: () => {
            void registry.refreshSession();
          },
        },
      }),
  },

  profile: {
    saveSuccess: () =>
      toast.success("Perfil actualizado", {
        description: "Tus datos se guardaron correctamente.",
      }),
    saveError: () =>
      toast.error("No se pudo guardar el perfil", {
        description: "Intenta de nuevo en un momento.",
      }),
    photoSuccess: () =>
      toast.success("Foto actualizada", {
        description: "Tu nueva foto de perfil ya está activa.",
      }),
    photoError: () =>
      toast.error("No se pudo subir la foto", {
        description:
          "Asegúrate de que sea JPG, PNG o WebP y pese menos de 2 MB.",
      }),
    photoSizeError: () =>
      toast.error("Foto demasiado grande", {
        description: "El archivo debe pesar menos de 2 MB.",
      }),
  },

  password: {
    changeSuccess: () =>
      toast.success("Contraseña actualizada", {
        description: "Tu contraseña se cambió correctamente.",
      }),
    changeError: () =>
      toast.error("No se pudo cambiar la contraseña", {
        description: "Verifica que tu contraseña actual sea correcta.",
      }),
    mismatch: () =>
      toast.error("Las contraseñas no coinciden", {
        description:
          "Asegúrate de escribir la misma contraseña en ambos campos.",
      }),
  },

  mfa: {
    enableSuccess: () =>
      toast.success("Verificación en dos pasos activada", {
        description:
          "Tu cuenta ahora tiene una capa extra de seguridad. 🔐",
      }),
    enableError: () =>
      toast.error("No se pudo activar el MFA", {
        description:
          "El código ingresado no es correcto. Intenta de nuevo.",
      }),
    disableSuccess: () =>
      toast.success("Verificación en dos pasos desactivada", {
        description:
          "Puedes reactivarla cuando quieras desde Configuración.",
      }),
    disableError: () =>
      toast.error("No se pudo desactivar el MFA", {
        description: "Intenta de nuevo en un momento.",
      }),
    invalidCode: () =>
      toast.error("Código incorrecto", {
        description: "El código de 6 dígitos no es válido o ya expiró.",
      }),
    genericError: () =>
      toast.error("No pudimos actualizar MFA", {
        description: "Intenta de nuevo en un momento.",
      }),
  },

  preferences: {
    themeChanged: (theme: string) => {
      const labels: Record<string, string> = {
        light: "Tema claro activado ☀️",
        dark: "Tema oscuro activado 🌙",
        system: "Tema del sistema activado 💻",
      };
      toast.success(labels[theme] ?? "Tema actualizado");
    },
    accentChanged: (color: string) => {
      const labels: Record<string, string> = {
        emerald: "Esmeralda",
        blue: "Azul",
        purple: "Morado",
        rose: "Rosa",
        amber: "Ámbar",
        slate: "Pizarra",
      };
      toast.success(`Color ${labels[color] ?? color} aplicado`);
    },
    languageChanged: (lang: string) =>
      toast.success(
        lang === "es"
          ? "Idioma cambiado a Español"
          : "Language changed to English",
      ),
    saveError: () =>
      toast.error("No se pudieron guardar las preferencias", {
        description: "Intenta de nuevo en un momento.",
      }),
  },

  expenses: {
    addSuccess: (name: string) =>
      toast.success("Gasto registrado", {
        description: `"${name}" se agregó correctamente.`,
      }),
    addError: () =>
      toast.error("No se pudo registrar el gasto", {
        description: "Verifica los datos e intenta de nuevo.",
      }),
    updateSuccess: () => toast.success("Gasto actualizado"),
    updateError: () =>
      toast.error("No se pudo actualizar el gasto", {
        description: "Intenta de nuevo en un momento.",
      }),
    deleteSuccess: (name: string) =>
      toast.success("Gasto eliminado", {
        description: `"${name}" fue removido.`,
      }),
    deleteError: () =>
      toast.error("No se pudo eliminar el gasto", {
        description: "Intenta de nuevo en un momento.",
      }),
    markPaidSuccess: (name: string) =>
      toast.success("Marcado como pagado ✓", {
        description: `"${name}" registrado como pagado.`,
      }),
    markPaidError: () =>
      toast.error("No se pudo actualizar el estado", {
        description: "Intenta de nuevo en un momento.",
      }),
  },

  income: {
    addSuccess: (amount: string) =>
      toast.success("Ingreso registrado", {
        description: `${amount} MXN agregado correctamente.`,
      }),
    addError: () =>
      toast.error("No se pudo registrar el ingreso", {
        description: "Verifica los datos e intenta de nuevo.",
      }),
    updateSuccess: () => toast.success("Ingreso actualizado"),
    deleteSuccess: () => toast.success("Ingreso eliminado"),
    missingAccount: () =>
      toast.warning("Primero agrega una cuenta bancaria", {
        description: "Ve a Configuración → Datos para agregar una cuenta.",
        action: {
          label: "Ir a Configuración",
          onClick: () => {
            registry.openAccountsSettings();
          },
        },
      }),
  },

  goals: {
    addSuccess: (name: string) =>
      toast.success("Meta creada 🎯", {
        description: `"${name}" fue agregada a tus metas.`,
      }),
    addError: () =>
      toast.error("No se pudo crear la meta", {
        description: "Verifica los datos e intenta de nuevo.",
      }),
    contributionSuccess: (amount: string, goal: string) =>
      toast.success("Abono registrado 💰", {
        description: `${amount} MXN aportado a "${goal}".`,
      }),
    contributionError: () =>
      toast.error("No se pudo registrar el abono", {
        description: "Verifica los datos e intenta de nuevo.",
      }),
    completedSuccess: (name: string) =>
      toast.success(`¡Meta alcanzada! 🎉`, {
        description: `Completaste "${name}". ¡Excelente trabajo!`,
        duration: 6000,
      }),
    updateSuccess: () => toast.success("Meta actualizada"),
    deleteSuccess: (name: string) =>
      toast.success("Meta eliminada", {
        description: `"${name}" fue removida.`,
      }),
  },

  debts: {
    addSuccess: (name: string) =>
      toast.success("Deuda registrada", {
        description: `"${name}" fue agregada al seguimiento.`,
      }),
    addError: () =>
      toast.error("No se pudo registrar la deuda", {
        description: "Verifica los datos e intenta de nuevo.",
      }),
    paymentSuccess: (amount: string, debt: string) =>
      toast.success("Pago registrado ✓", {
        description: `${amount} MXN abonado a "${debt}".`,
      }),
    paymentError: () =>
      toast.error("No se pudo registrar el pago", {
        description: "Intenta de nuevo en un momento.",
      }),
    paidOffSuccess: (name: string) =>
      toast.success(`¡Deuda liquidada! 🎊`, {
        description: `"${name}" está completamente pagada.`,
        duration: 6000,
      }),
  },

  accounts: {
    addSuccess: (name: string) =>
      toast.success("Cuenta agregada", {
        description: `"${name}" está lista para usar.`,
      }),
    addError: () =>
      toast.error("No se pudo agregar la cuenta", {
        description: "Intenta de nuevo en un momento.",
      }),
    updateSuccess: () => toast.success("Cuenta actualizada"),
    deleteError: () =>
      toast.error("No se puede eliminar esta cuenta", {
        description: "Tiene transacciones registradas asociadas.",
      }),
    deleteSuccess: (name: string) =>
      toast.success("Cuenta eliminada", {
        description: `"${name}" fue quitada.`,
      }),
  },

  categories: {
    deleteSuccess: () => toast.success("Categoría / subcategoría eliminada"),
    deleteError: () =>
      toast.error("No se pudo eliminar", {
        description: "Intenta de nuevo en un momento.",
      }),
  },

  notes: {
    saveSuccess: () => toast.success("Nota guardada"),
    saveError: () =>
      toast.error("No se pudo guardar la nota", {
        description: "Intenta de nuevo en un momento.",
      }),
    deleteSuccess: () => toast.success("Nota eliminada"),
    attachmentError: () =>
      toast.error("No se pudo subir el archivo", {
        description: "Verifica que sea PDF o imagen y pese menos de 10 MB.",
      }),
    createSuccess: () => toast.success("Nota creada"),
    createSuccessWithOpen: (opts: {
      navigate: () => void;
      openLabel: string;
    }) =>
      toast.success("Nota creada", {
        description: "Tu nota se guardó. Abre el editor para seguir editando.",
        duration: 8000,
        action: {
          label: opts.openLabel,
          onClick: () => {
            opts.navigate();
          },
        },
      }),
    createError: () =>
      toast.error("No se pudo crear la nota", {
        description: "Intenta de nuevo en un momento.",
      }),
  },

  ai: {
    error: () =>
      toast.error("El asesor no está disponible", {
        description:
          "No pudimos conectarnos. Intenta de nuevo en un momento.",
      }),
    rateLimit: () =>
      toast.warning("Demasiadas preguntas seguidas", {
        description: "Espera un momento antes de continuar.",
      }),
    conversationDeleted: () => toast.success("Conversación eliminada"),
    historyCleared: () => toast.success("Historial borrado"),
  },

  generic: {
    networkError: () =>
      toast.error("Sin conexión", {
        description: "Verifica tu internet e intenta de nuevo.",
      }),
    unexpectedError: () =>
      toast.error("Algo salió mal", {
        description:
          "Intenta de nuevo. Si el problema persiste, recarga la página.",
      }),
    copied: () => toast.success("Copiado al portapapeles"),
    saved: () => toast.success("Cambios guardados"),
    loadRetry: () =>
      toast.error("No pudimos cargar los datos", {
        description: "Revisa tu conexión o vuelve a intentar.",
      }),
  },
} as const;
