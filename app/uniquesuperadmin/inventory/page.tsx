"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageOpen,
  Plus,
  Search,
  Filter,
  Trash2,
  Pencil,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  Boxes,
  Layers,
  ShoppingCart,
  X,
  PlusCircle,
  MinusCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  inventoryApi,
  Product,
  Category as InventoryCategory,
} from "@/lib/api/inventory";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Define the local interface to match the backend Product response for state consistency
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  price: number;
  costPrice: number;
}

interface UpdateProductData {
  [key: string]: unknown;
  name?: string;
  categoryId?: string;
  unit?: string;
  lowStockThreshold?: number;
}

const DEFAULT_CATEGORIES = ["Drinks", "Equipment", "Apparel", "Others"];

export default function InventoryPage() {
  const queryClient = useQueryClient();

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => inventoryApi.getProducts(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => inventoryApi.getCategories(),
  });

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const { data: inventoryLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["inventory-logs"],
    queryFn: () => inventoryApi.getInventoryLogs(),
    enabled: logsModalOpen,
  });

  // Map products to inventory items
  const inventory: InventoryItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category?.name || "Uncategorized",
    stock: p.inventory,
    unit: p.unit,
    lowStockThreshold: p.lowStockThreshold,
    price: p.price,
    costPrice: p.costPrice,
  }));

  const isLoading = productsLoading;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    categoryId: "",
    unit: "pcs",
    lowStockThreshold: "10",
    bulkAddAmount: "0",
    costPrice: "0",
    price: "0",
  });

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    newCategoryName: "",
    initialStock: "",
    unit: "pcs",
    lowStockThreshold: "10",
    costPrice: "0",
    price: "0",
  });
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [processingId, setProcessingId] = useState<{id: string, type: 'add' | 'deduct'} | null>(null);
  
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItem, setSaleItem] = useState<InventoryItem | null>(null);
  const [saleCashAmount, setSaleCashAmount] = useState("");
  const [saleOnlineAmount, setSaleOnlineAmount] = useState("");

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: inventoryApi.createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const createProductMutation = useMutation({
    mutationFn: inventoryApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-logs"] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      inventoryApi.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-logs"] });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, amount, price, reason, cashAmount, onlineAmount }: { id: string; amount: number; price?: number; reason?: string; cashAmount?: number; onlineAmount?: number }) =>
      inventoryApi.adjustStock(id, amount, price, reason, cashAmount, onlineAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-logs"] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: inventoryApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-logs"] });
    },
  });

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId && !showNewCategoryInput) {
      toast.error("Please select a category");
      return;
    }

    if (showNewCategoryInput && !formData.newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    let categoryId = formData.categoryId;

    const addItemLogic = async () => {
      // 1. Create category if needed
      if (showNewCategoryInput) {
        const newCat = await createCategoryMutation.mutateAsync(
          formData.newCategoryName
        );
        categoryId = newCat.id;
      }

      // 2. Create product
      return await createProductMutation.mutateAsync({
        name: formData.name,
        categoryId: categoryId,
        inventory: parseInt(formData.initialStock) || 0,
        unit: formData.unit,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 10,
        price: parseFloat(formData.price) || 0,
        costPrice: parseFloat(formData.costPrice) || 0,
      });
    };

    const promise = addItemLogic();

    toast.promise(promise, {
      loading: "Adding item...",
      success: (data) => {
        setIsModalOpen(false);
        setFormData({
          name: "",
          categoryId: categoryId,
          newCategoryName: "",
          initialStock: "",
          unit: "pcs",
          lowStockThreshold: "10",
          costPrice: "0",
          price: "0",
        });
        setShowNewCategoryInput(false);
        return `${data.name} added to inventory`;
      },
      error: "Failed to add item",
    });
  };

  const handleAdjustStock = async (id: string, amount: number, confirmedPrice?: number, cashAmount?: number, onlineAmount?: number) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return;

    const isWater = item.name.toLowerCase().includes("water");

    // If it's a deduction and NOT water, and we haven't confirmed a price yet, show modal
    if (amount < 0 && !isWater && confirmedPrice === undefined) {
      setSaleItem(item);
      setSaleCashAmount(item.price.toString());
      setSaleOnlineAmount("0");
      setSaleModalOpen(true);
      return;
    }

    setProcessingId({ id, type: amount > 0 ? 'add' : 'deduct' });
    try {
      await adjustStockMutation.mutateAsync({ 
        id, 
        amount, 
        price: confirmedPrice,
        reason: confirmedPrice !== undefined ? `Manual Sale (Rs. ${confirmedPrice})` : undefined,
        cashAmount,
        onlineAmount
      });

      if (amount > 0)
        toast.success(`Added ${amount} ${item.unit} to ${item.name}`);
      else if (amount < 0)
        toast.info(
          `Deducted ${Math.abs(amount)} ${item.unit} from ${item.name}`
        );
    } catch (error) {
      toast.error("Failed to adjust stock");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    const promise = deleteProductMutation.mutateAsync(itemToDelete);

    toast.promise(promise, {
      loading: "Deleting item...",
      success: () => {
        setItemToDelete(null);
        return "Item removed from inventory";
      },
      error: "Failed to delete item",
    });
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    const cat = categories.find((c) => c.name === item.category);
    setEditFormData({
      name: item.name,
      categoryId: cat?.id || "",
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold.toString(),
      bulkAddAmount: "0",
      costPrice: (item.costPrice || 0).toString(),
      price: (item.price || 0).toString(),
    });
    setIsEditModalOpen(true);
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const bulkAmount = parseInt(editFormData.bulkAddAmount) || 0;

    const promise = updateProductMutation.mutateAsync({
      id: editingItem.id,
      data: {
        name: editFormData.name,
        categoryId: editFormData.categoryId,
        unit: editFormData.unit,
        lowStockThreshold: parseInt(editFormData.lowStockThreshold) || 10,
        price: parseFloat(editFormData.price) || 0,
        costPrice: parseFloat(editFormData.costPrice) || 0,
      },
    }).then(async (data) => {
      if (bulkAmount !== 0) {
        await adjustStockMutation.mutateAsync({
          id: editingItem.id,
          amount: bulkAmount,
          reason: "Bulk Edit Stock Update",
        });
      }
      return data;
    });

    toast.promise(promise, {
      loading: "Updating item...",
      success: (data) => {
        setIsEditModalOpen(false);
        setEditingItem(null);
        return `${data.name} updated`;
      },
      error: "Failed to update item",
    });
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === "All" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = inventory.filter(
    (item) => item.stock <= item.lowStockThreshold,
  );
  const totalItems = inventory.length;
  const outOfStock = inventory.filter((item) => item.stock === 0).length;

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Inventory <span className="text-[#FA6400]">Tracking</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Manage your stock of drinks, equipment, and other supplies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLogsModalOpen(true)}
            className="flex items-center gap-2 bg-white text-[#0c0b5d] border border-slate-200 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
          >
            <Layers size={16} />
            View Report
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            Add New Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Items
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#0c0b5d]">
              {totalItems}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#0c0b5d]">
              <Boxes size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Unique products
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Low Stock
          </span>
          <span className="text-2xl font-black text-amber-500">
            {lowStockItems.length}
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
              <AlertTriangle size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Needs restocking
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Out of Stock
          </span>
          <span className="text-2xl font-black text-red-500">{outOfStock}</span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
              <Package size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Unavailable
            </span>
          </div>
        </div>

        <div className="bg-[#0c0b5d] p-6 rounded-[24px] border border-[#0c0b5d] shadow-sm flex flex-col gap-1 text-white">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
            Quick Track
          </span>
          <div className="flex items-center gap-2 mt-auto">
            <ShoppingCart size={20} className="text-[#FA6400]" />
            <span className="text-xs font-bold italic">
              Stock Status:{" "}
              {lowStockItems.length > 0 ? "Attention Required" : "All Normal"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        {/* Filters Header */}
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-200">
              <Filter className="text-slate-400" size={18} />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-none focus:ring-0"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Showing {filteredInventory.length} items
          </div>
        </div>

        {/* Inventory List */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Item
                </th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Category
                </th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Current Stock
                </th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  Manage Stock
                </th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  Status
                </th>
                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#FA6400] border-t-transparent rounded-full animate-spin"></div>
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        Loading Inventory...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <PackageOpen size={48} />
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        Inventory is empty
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr
                    key={item.id}
                    className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#0c0b5d] uppercase tracking-tight">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Ref: #{item.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="inline-flex items-center px-3 py-1 rounded-full border border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        {item.category}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-black ${item.stock <= item.lowStockThreshold ? "text-amber-600" : "text-[#0c0b5d]"}`}
                        >
                          {item.stock} {item.unit}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => handleAdjustStock(item.id, -1)}
                          disabled={processingId?.id === item.id}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                          title="Deduct 1"
                        >
                          {processingId?.id === item.id && processingId.type === 'deduct' ? (
                            <Loader2 size={20} className="animate-spin text-red-500" />
                          ) : (
                            <MinusCircle size={20} />
                          )}
                        </button>
                        <button
                          onClick={() => handleAdjustStock(item.id, 1)}
                          disabled={processingId?.id === item.id}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer disabled:opacity-50"
                          title="Add 1"
                        >
                          {processingId?.id === item.id && processingId.type === 'add' ? (
                            <Loader2 size={20} className="animate-spin text-emerald-500" />
                          ) : (
                            <PlusCircle size={20} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center">
                      {item.stock === 0 ? (
                        <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100">
                          Out of Stock
                        </span>
                      ) : item.stock <= item.lowStockThreshold ? (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                          Healthy
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="p-2  text-blue-500 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  Inventory <span className="text-[#FA6400]">Check-in</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Add a new item to your warehouse
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Item Name
                </label>
                <div className="relative">
                  <Package
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Mineral Water, Football Shoes"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Category
                  </label>
                  {!showNewCategoryInput ? (
                    <div className="relative">
                      <select
                        required
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d] appearance-none"
                        value={formData.categoryId}
                        onChange={(e) => {
                          if (e.target.value === "ADD_NEW") {
                            setShowNewCategoryInput(true);
                            setFormData({ ...formData, categoryId: "" });
                          } else {
                            setFormData({
                              ...formData,
                              categoryId: e.target.value,
                            });
                          }
                        }}
                      >
                        <option value="" disabled>
                          Select Category
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option
                          value="ADD_NEW"
                          className="text-[#FA6400] font-bold"
                        >
                          + Add New Category
                        </option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Filter size={14} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          placeholder="New Category Name..."
                          className="w-full px-4 py-4 bg-amber-50/50 border border-amber-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FA6400]/10 transition-all text-[#0c0b5d]"
                          value={formData.newCategoryName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              newCategoryName: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewCategoryInput(false);
                            setFormData({ ...formData, newCategoryName: "" });
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Stock Unit
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Bottle, Pair, pc"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Cost Price (Rs)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, costPrice: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Selling Price (Rs)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Initial Stock
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="0"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.initialStock}
                    onChange={(e) =>
                      setFormData({ ...formData, initialStock: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Low Stock Alert At
                  </label>
                  <input
                    required
                    type="number"
                    placeholder="10"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lowStockThreshold: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 flex items-center justify-center gap-2 bg-[#FA6400] text-white py-5 rounded-[20px] font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FA6400]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={18} />
                Confirm Stock Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />

          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  Edit <span className="text-[#FA6400]">Item</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Update inventory item details
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditItem} className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Item Name
                </label>
                <div className="relative">
                  <Package
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Mineral Water, Football Shoes"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      required
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d] appearance-none"
                      value={editFormData.categoryId}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          categoryId: e.target.value,
                        })
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Unit
                  </label>
                  <select
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d] appearance-none"
                    value={editFormData.unit}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, unit: e.target.value })
                    }
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="bottles">Bottles</option>
                    <option value="pairs">Pairs</option>
                    <option value="sets">Sets</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="liters">Liters</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Cost Price (Rs)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={editFormData.costPrice}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        costPrice: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Selling Price (Rs)
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={editFormData.price}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        price: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Low Stock Threshold
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  placeholder="Alert when stock falls below"
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                  value={editFormData.lowStockThreshold}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      lowStockThreshold: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#FA6400]">
                  Add/Deduct Stock (Bulk)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-4 py-4 bg-orange-50 border border-orange-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FA6400]/10 transition-all text-[#0c0b5d]"
                  value={editFormData.bulkAddAmount}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      bulkAddAmount: e.target.value,
                    })
                  }
                />
                <span className="text-[9px] font-bold text-slate-400">Use positive numbers to add, negative to deduct. Applies to total stock instantly.</span>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#0c0b5d] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer active:scale-95"
              >
                Update Item
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Sale Modal */}
      {saleModalOpen && saleItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0c0b5d]/40 backdrop-blur-md" onClick={() => setSaleModalOpen(false)} />
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border-4 border-[#FA6400]">
            <div className="p-6 text-center flex flex-col gap-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-[#FA6400]">
                <ShoppingCart size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-tighter italic">Quick Sale</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{saleItem.name}</p>
              </div>
              
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-green-600">Cash Amount (Rs.)</label>
                  <input 
                    type="number"
                    autoFocus
                    value={saleCashAmount}
                    onChange={(e) => setSaleCashAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-green-50 border-2 border-green-100 rounded-2xl text-base font-black text-green-700 outline-none focus:border-green-500 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-600">Online Amount (Rs.)</label>
                  <input 
                    type="number"
                    value={saleOnlineAmount}
                    onChange={(e) => setSaleOnlineAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-100 rounded-2xl text-base font-black text-blue-700 outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={() => setSaleModalOpen(false)}
                  className="py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const cash = Number(saleCashAmount) || 0;
                    const online = Number(saleOnlineAmount) || 0;
                    handleAdjustStock(saleItem.id, -1, cash + online, cash, online);
                    setSaleModalOpen(false);
                  }}
                  className="py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white bg-[#FA6400] shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Confirm Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Inventory Item"
        description="Are you sure you want to delete this item from inventory? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        onConfirm={handleDeleteItem}
      />

      {/* Inventory Logs Modal */}
      {logsModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm" onClick={() => setLogsModalOpen(false)} />
          <div className="bg-white w-full max-w-4xl h-[80vh] flex flex-col rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  Inventory <span className="text-[#FA6400]">Logs</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Recent stock additions, deductions, and sales
                </p>
              </div>
              <button
                onClick={() => setLogsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date/Time</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Item</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Change</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Details/Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 text-sm font-bold">
                        Loading logs...
                      </td>
                    </tr>
                  ) : inventoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-400 text-sm font-bold">
                        No logs found.
                      </td>
                    </tr>
                  ) : (
                    inventoryLogs.map((log: { id: string; createdAt: string; product?: { name: string; unit: string }; change: number; reason: string; price?: number }) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-[#0c0b5d]">{log.product?.name || "Deleted Item"}</span>
                        </td>
                        <td className="px-6 py-4">
                          {log.change > 0 ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-black uppercase tracking-widest">Added</span>
                          ) : (
                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-[10px] font-black uppercase tracking-widest">Removed</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-black ${log.change > 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {log.change > 0 ? "+" : ""}{log.change} {log.product?.unit || ""}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {log.reason || "-"} {log.price ? <span className="text-[#FA6400] font-bold">(Sold at Rs. {log.price})</span> : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
