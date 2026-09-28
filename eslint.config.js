import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: { globals: { window: 'readonly', location: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', indexedDB: 'readonly', crypto: 'readonly', Blob: 'readonly', CustomEvent: 'readonly', FileReader: 'readonly', URL: 'readonly', confirm: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly' } },
    rules: {
      'no-unused-vars': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/require-default-prop': 'off'
    }
  }
]
