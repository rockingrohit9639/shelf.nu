import type { CustomField } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { useSearchParams } from "~/hooks/search-params";
import type { Column } from "~/modules/asset-index-settings/helpers";
import type { Filter, FilterFieldType, FilterOperator } from "./schema";
import type { Sort } from "../advanced-asset-index-filters-and-sorting";

/**
 * Represents how a field should be displayed and interacted with in the UI
 */
export type UIFieldType =
  | "string"
  | "text"
  | "boolean"
  | "date"
  | "number"
  | "enum"
  | "array";
/**
 * Mapping of friendly names for UI display
 */
const uiFieldTypeNames: Record<UIFieldType, string> = {
  string: "Single-line text",
  text: "Multi-line text",
  boolean: "Yes/No",
  date: "Date",
  number: "Number",
  enum: "Option",
  array: "List",
};

/**
 * Determines how a field should be presented and interacted with in the UI
 * Used for generating appropriate form controls and filter interfaces
 *
 * @param column - Column configuration object
 * @param friendlyName - Whether to return a user-friendly name instead of the technical type
 * @returns The UI field type or its friendly name
 */
export function getUIFieldType({
  column,
  friendlyName = false,
}: {
  column: Column;
  friendlyName?: boolean;
}): string {
  let fieldType: UIFieldType;

  // Determine base field type
  switch (column.name) {
    case "id":
    case "name":
      fieldType = "string";
      break;
    case "custody":
    case "status":
    case "category":
    case "location":
    case "kit":
      fieldType = "enum";
      break;
    case "description":
      fieldType = "text";
      break;
    case "valuation":
      fieldType = "number";
      break;
    case "availableToBook":
      fieldType = "boolean";
      break;
    case "createdAt":
      fieldType = "date";
      break;
    case "tags":
      fieldType = "array";
      break;
    default:
      // Handle custom fields
      if (column.name.startsWith("cf_")) {
        switch (column.cfType) {
          case "TEXT":
            fieldType = "string";
            break;
          case "MULTILINE_TEXT":
            fieldType = "text";
            break;
          case "BOOLEAN":
            fieldType = "boolean";
            break;
          case "DATE":
            fieldType = "date";
            break;
          case "OPTION":
            fieldType = "enum";
            break;
          default:
            fieldType = "string";
        }
      } else {
        fieldType = "string";
      }
  }

  return friendlyName ? uiFieldTypeNames[fieldType] : fieldType;
}
/** Gets the intial filters of the advanced index based on search params
 * @returns intialFilters -{@link Filter, Filter[]}
 */
export function useInitialFilters(columns: Column[]) {
  const [searchParams] = useSearchParams();

  const initialFilters: Filter[] = [];
  searchParams.forEach((value, key) => {
    const column = columns.find((c) => c.name === key);
    if (column) {
      const [operator, filterValue] = value.split(":");

      initialFilters.push({
        name: key,
        operator: operator as FilterOperator,
        value: operator === "between" ? filterValue.split(",") : filterValue, // Split the value if it's a range
        type: getUIFieldType({ column }) as FilterFieldType,
      });
    }
  });
  return initialFilters;
}

// Function to get default value based on field type
export function getDefaultValueForFieldType(
  column: Column,
  customFields: SerializeFrom<CustomField[]> | null // Update the type to allow null
): any {
  if (column.name.startsWith("cf_")) {
    // Find the matching custom field, handle potential null customFields
    const customField = customFields?.find(
      (cf) => `cf_${cf.name}` === column.name
    );

    switch (column.cfType) {
      case "DATE":
        return new Date().toISOString().split("T")[0];
      case "BOOLEAN":
        return true;
      case "OPTION":
        return customField?.options?.[0] || "";
      case "TEXT":
      case "MULTILINE_TEXT":
        return "";
      default:
        return "";
    }
  } else {
    // Handle regular fields
    switch (getUIFieldType({ column })) {
      case "boolean":
        return true;
      case "date":
        return new Date().toISOString().split("T")[0];
      case "number":
        return 0;
      default:
        return "";
    }
  }
}

/**
 * Determines what columns are available based on already used columns and operation type
 * @param columns - All available columns
 * @param usedColumns - Currently used columns (filters or sorts)
 * @param operation - Whether we're filtering or sorting
 * @returns Filtered list of available columns
 */
export function getAvailableColumns(
  columns: Column[],
  usedColumns: Array<Filter | Sort>,
  operation: "filter" | "sort"
) {
  // Get columns that are visible and not already used
  const availableColumns = columns.filter(
    (column) =>
      column.visible && !usedColumns.find((f) => f.name === column.name)
  );

  // Apply operation-specific filtering
  return availableColumns.filter((column) => {
    // Common exclusions for both operations
    if (!column.visible) return false;

    if (operation === "sort") {
      // Columns that can't be sorted
      const unsortableColumns = ["tags"];
      if (unsortableColumns.includes(column.name)) return false;

      // Custom fields that can't be sorted
      if (column.name.startsWith("cf_")) {
        const unsortableTypes = ["MULTILINE_TEXT"];
        return !unsortableTypes.includes(column.cfType || "");
      }

      return true;
    }

    if (operation === "filter") {
      const unfilterableColumns: string[] = [];
      if (unfilterableColumns.includes(column.name)) return false;

      return true;
    }

    return true;
  });
}