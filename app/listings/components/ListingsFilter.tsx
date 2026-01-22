"use client";

import { useMemo } from "react";
import { Search, Home, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ListingStatus = "active" | "pending" | "sold" | "off-market";
export type PropertyType = "house" | "condo" | "townhouse" | "multi-family";
export type SortOption =
    | "newest"
    | "price-high"
    | "price-low"
    | "most-interest";

interface ListingsFilterProps {
    onSearchChange: (search: string) => void;
    onStatusChange: (statuses: ListingStatus[]) => void;
    onPropertyTypeChange: (types: PropertyType[]) => void;
    onSortChange: (sort: SortOption) => void;
    selectedStatuses: ListingStatus[];
    selectedPropertyTypes: PropertyType[];
    selectedSort: SortOption;
    searchTerm: string;
    totalListings: number;
    filteredCount: number;
}

const statusOptions: { value: ListingStatus; label: string; color: string }[] =
    [
        { value: "active", label: "Active", color: "bg-emerald-500" },
        { value: "pending", label: "Pending", color: "bg-amber-500" },
        { value: "sold", label: "Sold", color: "bg-violet-500" },
        { value: "off-market", label: "Off Market", color: "bg-gray-500" },
    ];

const propertyTypeOptions: { value: PropertyType; label: string }[] = [
    { value: "house", label: "House" },
    { value: "condo", label: "Condo" },
    { value: "townhouse", label: "Townhouse" },
    { value: "multi-family", label: "Multi-family" },
];

const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest First" },
    { value: "price-high", label: "Price: High to Low" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "most-interest", label: "Most Interest" },
];

export function ListingsFilter({
    onSearchChange,
    onStatusChange,
    onPropertyTypeChange,
    onSortChange,
    selectedStatuses,
    selectedPropertyTypes,
    selectedSort,
    searchTerm,
    totalListings,
    filteredCount,
}: ListingsFilterProps) {
    const activeFiltersCount = useMemo(() => {
        return selectedStatuses.length + selectedPropertyTypes.length;
    }, [selectedStatuses.length, selectedPropertyTypes.length]);

    const handleStatusToggle = (status: ListingStatus) => {
        if (selectedStatuses.includes(status)) {
            onStatusChange(selectedStatuses.filter((s) => s !== status));
        } else {
            onStatusChange([...selectedStatuses, status]);
        }
    };

    const handlePropertyTypeToggle = (type: PropertyType) => {
        if (selectedPropertyTypes.includes(type)) {
            onPropertyTypeChange(
                selectedPropertyTypes.filter((t) => t !== type),
            );
        } else {
            onPropertyTypeChange([...selectedPropertyTypes, type]);
        }
    };

    const clearAllFilters = () => {
        onSearchChange("");
        onStatusChange([]);
        onPropertyTypeChange([]);
        onSortChange("newest");
    };

    return (
        <div className="space-y-4">
            {/* Main filter row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by address…"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                {/* Status filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="gap-2 border-muted bg-muted/50"
                        >
                            <div className="flex -space-x-1">
                                {selectedStatuses.length === 0 ? (
                                    <div className="size-2.5 rounded-full bg-muted-foreground/30" />
                                ) : (
                                    selectedStatuses
                                        .slice(0, 3)
                                        .map((status) => (
                                            <div
                                                key={status}
                                                className={cn(
                                                    "size-2.5 rounded-full ring-2 ring-background",
                                                    statusOptions.find(
                                                        (s) =>
                                                            s.value === status,
                                                    )?.color,
                                                )}
                                            />
                                        ))
                                )}
                            </div>
                            Status
                            <ChevronDown className="size-3.5 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.map((status) => (
                            <DropdownMenuCheckboxItem
                                key={status.value}
                                checked={selectedStatuses.includes(
                                    status.value,
                                )}
                                onCheckedChange={() =>
                                    handleStatusToggle(status.value)
                                }
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "size-2.5 rounded-full",
                                            status.color,
                                        )}
                                    />
                                    {status.label}
                                </div>
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Property type filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="gap-2 border-muted bg-muted/50"
                        >
                            <Home className="size-4 opacity-50" />
                            Type
                            {selectedPropertyTypes.length > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-1 h-5 px-1.5 text-xs"
                                >
                                    {selectedPropertyTypes.length}
                                </Badge>
                            )}
                            <ChevronDown className="size-3.5 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuLabel>Property Type</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {propertyTypeOptions.map((type) => (
                            <DropdownMenuCheckboxItem
                                key={type.value}
                                checked={selectedPropertyTypes.includes(
                                    type.value,
                                )}
                                onCheckedChange={() =>
                                    handlePropertyTypeToggle(type.value)
                                }
                            >
                                {type.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort */}
                <Select
                    value={selectedSort}
                    onValueChange={(v) => onSortChange(v as SortOption)}
                >
                    <SelectTrigger className="w-[160px] border-muted bg-muted/50">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Clear filters */}
                {activeFiltersCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Clear all
                        <X className="ml-1 size-3" />
                    </Button>
                )}

                {/* Results count */}
                <div className="ml-auto text-sm text-muted-foreground tabular-nums">
                    {filteredCount === totalListings ? (
                        <span>{totalListings} listings</span>
                    ) : (
                        <span>
                            {filteredCount} of {totalListings} listings
                        </span>
                    )}
                </div>
            </div>

            {/* Active filter badges */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedStatuses.map((status) => {
                        const opt = statusOptions.find(
                            (s) => s.value === status,
                        );
                        return (
                            <Badge
                                key={status}
                                variant="secondary"
                                className="gap-1.5 pl-2 pr-1 py-1"
                            >
                                <div
                                    className={cn(
                                        "size-2 rounded-full",
                                        opt?.color,
                                    )}
                                />
                                {opt?.label}
                                <button
                                    onClick={() => handleStatusToggle(status)}
                                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        );
                    })}
                    {selectedPropertyTypes.map((type) => {
                        const opt = propertyTypeOptions.find(
                            (t) => t.value === type,
                        );
                        return (
                            <Badge
                                key={type}
                                variant="secondary"
                                className="gap-1.5 pr-1 py-1"
                            >
                                {opt?.label}
                                <button
                                    onClick={() =>
                                        handlePropertyTypeToggle(type)
                                    }
                                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted transition-colors"
                                >
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
