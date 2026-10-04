# Bookings Module - TanStack Query Structure

Professional folder structure for managing bookings with TanStack Query (React Query).

## 📁 Folder Structure

```
lib/
├── api/
│   └── bookings.ts           # API client functions (fetch, create, update)
├── hooks/
│   └── bookings/
│       ├── index.ts           # Barrel export
│       ├── queries.ts         # Query keys & configuration
│       ├── useBookings.ts     # Fetch all bookings
│       ├── useAvailableSlots.ts # Fetch available time slots
│       ├── useCreateBooking.ts  # Create booking mutation
│       ├── useUpdateBooking.ts  # Update booking mutation
│       └── useCancelBooking.ts  # Cancel booking mutation
└── types/
    └── booking.ts            # TypeScript type definitions
```

## 🎯 Usage Examples

### Fetch Bookings

```tsx
import { useBookings } from "@/lib/hooks";

function BookingsPage() {
  const { data: bookings, isLoading, error } = useBookings({ 
    status: "confirmed" 
  });
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <BookingsList bookings={bookings} />;
}
```

### Fetch Available Slots

```tsx
import { useAvailableSlots } from "@/lib/hooks";

function SlotPicker({ date, duration }) {
  const { data: slots, isLoading } = useAvailableSlots(date, duration);
  
  return (
    <div>
      {slots?.map(slot => (
        <button key={slot}>{slot}</button>
      ))}
    </div>
  );
}
```

### Create Booking

```tsx
import { useCreateBooking } from "@/lib/hooks";

function BookingForm() {
  const createBooking = useCreateBooking();
  
  const handleSubmit = (data) => {
    createBooking.mutate(data, {
      onSuccess: (booking) => {
        console.log("Booking created:", booking.id);
      },
      onError: (error) => {
        console.error("Failed:", error.message);
      }
    });
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Update Booking

```tsx
import { useUpdateBooking } from "@/lib/hooks";

function BookingActions({ bookingId }) {
  const updateBooking = useUpdateBooking();
  
  const confirm = () => {
    updateBooking.mutate({ 
      id: bookingId, 
      updates: { status: "confirmed" } 
    });
  };
  
  return <button onClick={confirm}>Confirm</button>;
}
```

## 🔑 Query Keys

Query keys are centralized in `queries.ts` for type safety and cache management:

```ts
import { bookingKeys } from "@/lib/hooks/bookings";

// Invalidate all bookings
queryClient.invalidateQueries({ queryKey: bookingKeys.all });

// Invalidate specific date's slots
queryClient.invalidateQueries({ 
  queryKey: bookingKeys.availableSlots("2026-03-31", 1) 
});
```

## ⚙️ Configuration

Default query options are defined in `queries.ts`:

- **Bookings**: 30s stale time, 15s polling
- **Slots**: 10s stale time (frequently changing data)
- **Cache Time**: 5 minutes for bookings, 1 minute for slots

## 🎨 Benefits

1. **Separation of Concerns**: API logic, hooks, and types are separated
2. **Reusability**: Each hook is focused on a single responsibility
3. **Type Safety**: Centralized TypeScript types
4. **Cache Management**: Organized query keys for efficient invalidation
5. **Maintainability**: Easy to find and update specific functionality
6. **Scalability**: Easy to add new booking-related hooks
