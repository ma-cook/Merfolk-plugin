<template>
  <header>
    <nav>
      <span>Count: {{ counter.count }}</span>
      <button @click="counter.increment">+</button>
    </nav>
  </header>
</template>

<script setup>
import { useCounter } from '../composables/useCounter';

const counter = useCounter();
</script>
