<template>
  <v-list-item v-if="item.page" :to="item.page">
    <v-list-item-title>{{ item.name }}</v-list-item-title>
  </v-list-item>
  <v-list-group v-else :value="item.name">
    <template #activator="{ props }">
      <v-list-item v-bind="props" :title="item.name"/>
    </template>
    <v-list-item v-for="nestedItem in item.items" :key="nestedItem.page" :to="nestedItem.page">
      <v-list-item-title>{{ nestedItem.name }}</v-list-item-title>
    </v-list-item>
  </v-list-group>
</template>
<script setup>
defineProps(["item"])
</script>
