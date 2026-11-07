<template>
  <div class="text-center ma-2">
    <v-snackbar
      v-for="snackbar, index in store.snackbars" :key="index" v-model="store.snackbars[index].show"
      :color="snackbar.color">
      <template #text>
        {{ snackbar.text }}
      </template>
      <template #actions>
        <v-btn :color="snackbar.color ? undefined : 'pink'" variant="text" @click="store.snackbars[index].show = false">
          OK
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>
<script setup>
const store = useStore();
</script>
