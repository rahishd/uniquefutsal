# Settings Module - TanStack Query Structure

Professional folder structure for managing settings, promo codes, and pricing with TanStack Query (React Query).

## 📁 Folder Structure

```
lib/
├── api/
│   └── settings.ts           # API client functions
├── hooks/
│   └── settings/
│       ├── index.ts           # Barrel export
│       ├── queries.ts         # Query keys & configuration
│       ├── useSettings.ts     # Fetch all settings
│       ├── usePromoCodes.ts   # Fetch promo codes (with active/expired filtering)
│       └── useUpdateSettings.ts # Update settings mutation
└── types/
    └── booking.ts            # TypeScript type definitions
```

## 🎯 Usage Examples

### Fetch All Settings

```tsx
import { useSettings } from "@/lib/hooks";

function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings();
  
  return (
    <div>
      <p>Hourly Rate: Rs. {settings?.settings.hourlyRate}</p>
      <p>Time Slots: {settings?.settings.timeSlots.join(", ")}</p>
    </div>
  );
}
```

### Fetch Promo Codes (Filtered)

```tsx
import { usePromoCodes } from "@/lib/hooks";

function PromoCodePage() {
  const { data: promoData, isLoading } = usePromoCodes();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Active Promo Codes ({promoData.active.length})</h2>
      {promoData.active.map(promo => (
        <div key={promo.code}>{promo.code} - {promo.value}% OFF</div>
      ))}
      
      <h2>Expired Promo Codes ({promoData.expired.length})</h2>
      {promoData.expired.map(promo => (
        <div key={promo.code}>{promo.code}</div>
      ))}
    </div>
  );
}
```

### Update Settings

```tsx
import { useUpdateSettings } from "@/lib/hooks";

function AdminSettings() {
  const updateSettings = useUpdateSettings();
  
  const handleUpdate = () => {
    updateSettings.mutate({
      hourlyRate: 50,
      advanceDeposit: 600,
    }, {
      onSuccess: () => {
        console.log("Settings updated!");
      },
      onError: (error) => {
        console.error("Failed:", error.message);
      }
    });
  };
  
  return <button onClick={handleUpdate}>Update</button>;
}
```

## 🔑 Query Keys

Query keys are centralized in `queries.ts`:

```ts
import { settingsKeys } from "@/lib/hooks/settings";

// Invalidate all settings
queryClient.invalidateQueries({ queryKey: settingsKeys.all });

// Invalidate specific settings
queryClient.invalidateQueries({ queryKey: settingsKeys.promoCodes() });
```

## ⚙️ Configuration

Default query options in `queries.ts`:

- **Stale Time**: 5 minutes (settings don't change frequently)
- **Cache Time**: 10 minutes
- **Refetch on Window Focus**: Disabled (to reduce unnecessary requests)

## 🎨 Benefits

1. **Automatic Filtering**: `usePromoCodes` automatically filters expired promo codes
2. **Type Safety**: Full TypeScript support with inferred types
3. **Cache Management**: Organized query keys for efficient invalidation
4. **Optimistic Updates**: Settings mutations update cache immediately
5. **Reusability**: Clean hooks for different settings data
