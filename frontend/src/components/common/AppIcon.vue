<template>
  <component 
    :is="iconComponent" 
    :class="iconClasses"
    :style="iconStyles"
  />
</template>

<script>
import { computed } from 'vue'
// Heroicons imports
import {
  PlusIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  UserIcon,
  UsersIcon,
  BanknotesIcon,
  PrinterIcon,
  QrCodeIcon,
  CommandLineIcon,
  ArrowsUpDownIcon,
  BeakerIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  DocumentIcon,
  EyeIcon,
  HomeIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  StarIcon,
  PresentationChartBarIcon,
  UserCircleIcon,
  BriefcaseIcon,
  ComputerDesktopIcon,
  HandRaisedIcon
} from '@heroicons/vue/24/outline'

import {
  PlusIcon as PlusIconSolid,
  XMarkIcon as XMarkIconSolid,
  CheckIcon as CheckIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  InformationCircleIcon as InformationCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  ClockIcon as ClockIconSolid,
  UserIcon as UserIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UsersIcon as UsersIconSolid,
  StarIcon as StarIconSolid
} from '@heroicons/vue/24/solid'

export default {
  name: 'AppIcon',
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: [String, Number],
      default: 20
    },
    solid: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: null
    },
    class: {
      type: [String, Array, Object],
      default: null
    }
  },
  setup(props) {
    // Icon mapping
    const iconMap = {
      // Basic actions
      'plus': PlusIcon,
      'close': XMarkIcon,
      'x': XMarkIcon,
      'check': CheckIcon,
      'edit': PencilIcon,
      'delete': TrashIcon,
      'trash': TrashIcon,
      
      // Navigation
      'chevron-left': ChevronLeftIcon,
      'chevron-right': ChevronRightIcon,
      'chevron-up': ChevronUpIcon,
      'chevron-down': ChevronDownIcon,
      'arrow-left': ChevronLeftIcon,
      'arrow-right': ChevronRightIcon,
      'prev': ChevronLeftIcon,
      'next': ChevronRightIcon,
      'arrows-up-down': ArrowsUpDownIcon,
      'sort': ArrowsUpDownIcon,
      
      // Status & feedback
      'warning': ExclamationTriangleIcon,
      'error': XCircleIcon,
      'info': InformationCircleIcon,
      'success': CheckCircleIcon,
      'completed': CheckCircleIcon,
      'failed': XCircleIcon,
      'clock': ClockIcon,
      'time': ClockIcon,
      
      // Business specific
      'calendar': CalendarDaysIcon,
      'user': UserIcon,
      'users': UsersIcon,
      'employee': UserIcon,
      'employees': UsersIcon,
      'money': BanknotesIcon,
      'salary': BanknotesIcon,
      'currency': CurrencyDollarIcon,
      'print': PrinterIcon,
      'qr': QrCodeIcon,
      'keyboard': CommandLineIcon,
      'manual': CommandLineIcon,
      
      // Emoji replacements
      '👥': UsersIcon,
      '📊': ChartBarIcon,
      '✅': CheckCircleIcon,
      '❌': XCircleIcon,
      '📱': DevicePhoneMobileIcon,
      '💰': CurrencyDollarIcon,
      '📈': ChartBarSquareIcon,
      '📉': ChartBarSquareIcon,
      '📅': CalendarDaysIcon,
      '⏰': ClockIcon,
      '👤': UserIcon,
      '🏢': BuildingOfficeIcon,
      '🔍': MagnifyingGlassIcon,
      '✏️': PencilIcon,
      '🗑️': TrashIcon,
      '➕': PlusIcon,
      '📋': ClipboardDocumentListIcon,
      '📄': DocumentTextIcon,
      '📝': DocumentTextIcon,
      '⭐': StarIcon,
      '👨‍💼': BriefcaseIcon,
      '👩‍💻': ComputerDesktopIcon,
      '🍽️': BuildingOfficeIcon,
      '👨‍🍳': BeakerIcon,
      '💼': BriefcaseIcon,
      
      // Sections
      'hall': BuildingOfficeIcon,
      'kitchen': BeakerIcon,
      'restaurant': BuildingOfficeIcon,
      
      // Analytics & Stats
      'analytics': PresentationChartBarIcon,
      'dashboard': PresentationChartBarIcon,
      'chart': ChartBarIcon,
      'stats': ChartBarIcon,
      'trending': ChartBarSquareIcon,
      'growth': ChartBarSquareIcon,
      
      // Search & Discovery
      'search': MagnifyingGlassIcon,
      'find': MagnifyingGlassIcon,
      
      // Documents & Lists
      'clipboard': ClipboardDocumentListIcon,
      'list': ClipboardDocumentListIcon,
      'document': DocumentIcon,
      'text': DocumentTextIcon,
      'notes': DocumentTextIcon,
      
      // Devices & Technology
      'mobile': DevicePhoneMobileIcon,
      'phone': DevicePhoneMobileIcon,
      'app': DevicePhoneMobileIcon,
      'desktop': ComputerDesktopIcon,
      'computer': ComputerDesktopIcon,
      
      // Ratings & Quality
      'star': StarIcon,
      'rating': StarIcon,
      'favorite': StarIcon,
      
      // Profile & Identity
      'profile': UserCircleIcon,
      'account': UserCircleIcon,
      
      // Work & Business
      'work': BriefcaseIcon,
      'job': BriefcaseIcon,
      'business': BriefcaseIcon,
      
      // Gestures
      'hand': HandRaisedIcon,
      'wave': HandRaisedIcon,
      
      // Other
      'eye': EyeIcon,
      'home': HomeIcon,
      'settings': CogIcon,
      'notification': BellIcon,
      'bell': BellIcon,
      'shield': ShieldCheckIcon,
      'security': ShieldCheckIcon
    }
    
    // Solid version mapping
    const solidIconMap = {
      'plus': PlusIconSolid,
      'close': XMarkIconSolid,
      'x': XMarkIconSolid,
      'check': CheckIconSolid,
      'warning': ExclamationTriangleIconSolid,
      'error': XCircleIconSolid,
      'info': InformationCircleIconSolid,
      'success': CheckCircleIconSolid,
      'completed': CheckCircleIconSolid,
      'clock': ClockIconSolid,
      'time': ClockIconSolid,
      'user': UserIconSolid,
      'employee': UserIconSolid,
      'money': BanknotesIconSolid,
      'salary': BanknotesIconSolid,
      
      // Emoji solid versions
      '👥': UsersIconSolid,
      '📊': ChartBarIconSolid,
      '✅': CheckCircleIconSolid,
      '❌': XCircleIconSolid,
      '📱': DevicePhoneMobileIconSolid,
      '💰': BanknotesIconSolid,
      '👤': UserIconSolid,
      '⭐': StarIconSolid,
      
      // Additional solid mappings
      'users': UsersIconSolid,
      'employees': UsersIconSolid,
      'stats': ChartBarIconSolid,
      'chart': ChartBarIconSolid,
      'mobile': DevicePhoneMobileIconSolid,
      'phone': DevicePhoneMobileIconSolid,
      'app': DevicePhoneMobileIconSolid,
      'star': StarIconSolid,
      'rating': StarIconSolid,
      'favorite': StarIconSolid
    }

    const iconComponent = computed(() => {
      const iconName = props.name.toLowerCase()
      
      // Use solid version if requested and available
      if (props.solid && solidIconMap[iconName]) {
        return solidIconMap[iconName]
      }
      
      // Use outline version
      return iconMap[iconName] || InformationCircleIcon
    })

    const iconClasses = computed(() => {
      const classes = ['app-icon']
      
      // Add custom classes
      if (props.class) {
        if (typeof props.class === 'string') {
          classes.push(props.class)
        } else if (Array.isArray(props.class)) {
          classes.push(...props.class)
        } else {
          // Handle object class syntax
          Object.keys(props.class).forEach(key => {
            if (props.class[key]) classes.push(key)
          })
        }
      }
      
      return classes
    })

    const iconStyles = computed(() => {
      const styles = {}
      
      // Set size
      const size = typeof props.size === 'number' ? `${props.size}px` : props.size
      styles.width = size
      styles.height = size
      
      // Set color if provided
      if (props.color) {
        styles.color = props.color
      }
      
      return styles
    })

    return {
      iconComponent,
      iconClasses,
      iconStyles
    }
  }
}
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>