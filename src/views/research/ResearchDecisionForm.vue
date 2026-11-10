<template>
<section class="decision-form" :aria-labelledby="inputId('title')">
 <header><h4 :id="inputId('title')">{{presentation.title}}</h4><p v-if="presentation.description">{{presentation.description}}</p></header>
 <div v-for="field in form.fields" :key="field.key" class="decision-field">
  <label :id="inputId(field.key)+'-label'" :for="['radio-group','checkbox-group'].includes(field.kind)?undefined:inputId(field.key)">{{presentation.label(field)}}<strong v-if="field.required">必填</strong></label>
  <div v-if="field.kind==='radio-group'||field.kind==='checkbox-group'" class="decision-choices" :role="field.kind==='radio-group'?'radiogroup':'group'" :aria-labelledby="inputId(field.key)+'-label'" :aria-required="field.required">
   <label v-for="option in field.options" :key="option" class="decision-option" :class="{selected:checked(field,option),disabled:busy}">
    <input :type="field.kind==='radio-group'?'radio':'checkbox'" :name="inputId(field.key)" :disabled="busy" :checked="checked(field,option)" @change="emit('choice',field,option)" />
    <span><b>{{presentation.option(field,option).title}}</b><small v-if="presentation.option(field,option).description">{{presentation.option(field,option).description}}</small></span>
   </label>
  </div>
  <textarea v-else-if="field.kind==='textarea'" :id="inputId(field.key)" :disabled="busy" :value="String(value(field)??'')" :placeholder="presentation.placeholder(field)" :minlength="field.minLength" :maxlength="field.maxLength" @input="emit('field',field,$event)" />
  <select v-else-if="field.kind==='select'" :id="inputId(field.key)" :disabled="busy" :value="String(value(field)??'')" @change="emit('field',field,$event)"><option value="">请选择</option><option v-for="option in field.options" :key="option" :value="option">{{option}}</option></select>
  <template v-else-if="field.kind==='other-text'"><input :id="inputId(field.key)" :list="inputId(field.key)+'-options'" :disabled="busy" :value="String(value(field)??'')" :placeholder="field.placeholder||'选择或填写其他内容'" @input="emit('field',field,$event)" /><datalist :id="inputId(field.key)+'-options'"><option v-for="option in field.options" :key="option" :value="option" /></datalist></template>
  <input v-else :id="inputId(field.key)" :type="field.kind==='number'?'number':'text'" :disabled="busy" :value="String(value(field)??'')" :placeholder="field.placeholder" :min="field.min" :max="field.max" :step="field.step" :minlength="field.minLength" :maxlength="field.maxLength" @input="emit('field',field,$event)" />
 </div>
 <details v-if="presentation.known" class="decision-original"><summary>查看相关记录</summary><p>{{form.title}}</p><p v-for="field in form.fields" :key="field.key">{{field.label}}<span v-for="option in field.options" :key="option">{{option}}</span></p></details>
</section>
</template>
<script setup lang="ts">
import {computed} from 'vue'
import type {ResearchForm,ResearchField} from '@/api/szRun'
import {researchFormPresentation} from '@/utils/researchFormPresentation'
const props=defineProps<{form:ResearchForm;answers?:Record<string,unknown>;busy?:boolean}>()
const emit=defineEmits<{field:[field:ResearchField,event:Event];choice:[field:ResearchField,option:string]}>()
const presentation=computed(()=>researchFormPresentation(props.form))
const inputId=(key:string)=>'decision-'+encodeURIComponent(props.form.interruptId)+'-'+encodeURIComponent(key)
const value=(field:ResearchField)=>props.answers?.[field.key]
const checked=(field:ResearchField,option:string)=>field.kind==='checkbox-group'?Array.isArray(value(field))&&(value(field) as unknown[]).includes(option):value(field)===option
</script>
<style scoped>
.decision-form{margin:16px 0 18px;padding:0;color:#315f69}.decision-form header{padding:0 0 14px;border-bottom:1px solid #d3e5df}.decision-form h4{margin:0;color:#123f46;font-size:18px;font-weight:700;line-height:1.5}.decision-form header p{margin:9px 0 0;line-height:1.75;font-size:14px}.decision-field{margin-top:20px}.decision-field>label{display:block;margin-bottom:10px;font-size:14px;font-weight:650;color:#27555c;line-height:1.65}.decision-field>label strong{display:inline-block;margin-left:8px;color:#987020;font-size:11px;font-weight:500}.decision-choices{display:grid;gap:9px}.decision-option{display:flex;align-items:flex-start;gap:11px;padding:13px 15px;border:1px solid #b7cfc8;border-radius:9px;background:#fff;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s}.decision-option input{flex-shrink:0;margin:4px 0 0;width:16px;height:16px;accent-color:#078b7d}.decision-option span{min-width:0}.decision-option b{display:block;font-size:14px;font-weight:600;line-height:1.7;color:#244f56}.decision-option small{display:block;margin-top:3px;font-size:13px;line-height:1.65;color:#57777b}.decision-option:hover:not(.disabled){background:#f6fbf9;border-color:#6ea99c}.decision-option.selected{border-color:#088f80;background:#eaf7f2;box-shadow:inset 0 0 0 1px #088f80}.decision-option:focus-within{outline:2px solid #239c8a;outline-offset:3px}.decision-option.disabled{cursor:default;opacity:.7}.decision-field textarea,.decision-field>input,.decision-field select{box-sizing:border-box;width:100%;border:1px solid #a6c7bf;border-radius:8px;padding:11px 13px;font:inherit;color:#315f69;background:#fff}.decision-field textarea{min-height:88px;resize:vertical;line-height:1.7}.decision-field textarea:focus,.decision-field>input:focus,.decision-field select:focus{outline:2px solid #239c8a;outline-offset:2px}.decision-original{margin-top:16px;font-size:12px;color:#617f83}.decision-original summary{cursor:pointer;width:fit-content}.decision-original p{line-height:1.7;overflow-wrap:anywhere}.decision-original span{display:block;margin-top:4px}@media(prefers-reduced-motion:reduce){.decision-option{transition:none}}
</style>
