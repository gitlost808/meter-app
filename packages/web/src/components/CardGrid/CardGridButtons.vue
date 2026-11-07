<template>
  <v-col cols="12">
    <v-card>
      <v-card-text>
        <slot />
      </v-card-text>
    </v-card>
  </v-col>
</template>
<script setup>
defineProps(['name'])
</script>