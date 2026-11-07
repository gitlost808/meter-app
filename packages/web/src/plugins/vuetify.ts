import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";
import { de } from "vuetify/locale";
import { VDateInput, VNumberInput } from "vuetify/components";

export const vuetify = createVuetify({
  components: {
    VNumberInput,
    VDateInput,
  },
  locale: {
    locale: "de",
    fallback: "en",
    messages: {
      de,
    },
  },
  theme: {
    defaultTheme: "dark",
  },
});
