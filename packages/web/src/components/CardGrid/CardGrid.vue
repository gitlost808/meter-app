<template>
  <v-row>
    <CardGridButtons :name="name">
      <slot name="form"/>
    </CardGridButtons>
    <v-col v-for="item in items" :key="item.id" cols="12" md="6" lg="3">
      <slot :item="item" />
    </v-col>
  </v-row>
</template>
<script setup>
defineProps(['items', 'name'])
</script>