<!-- src/features/reward/components/ConfettiLayer.vue -->

<template>
  <div v-if="show" class="confetti-layer">
    <span
      v-for="c in pieces"
      :key="c.id"
      class="piece"
      :style="{
        left: c.left + '%',
        background: c.color,
        animationDelay: c.delay + 'ms',
        animationDuration: c.duration + 'ms'
      }"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  pieces: Array<{ id:number; left:number; delay:number; duration:number; color:string }>
}>()
</script>

<style scoped>
.confetti-layer {
  position: fixed; inset: 0; overflow: hidden;
  pointer-events: none; z-index: 5000;
}
.piece {
  position: absolute; top: -12px;
  width: 10px; height: 14px;
  border-radius: 2px;
  animation: fall linear forwards;
}
@keyframes fall {
  from { transform: translateY(-16px) }
  to   { transform: translateY(110vh) }
}
</style>
