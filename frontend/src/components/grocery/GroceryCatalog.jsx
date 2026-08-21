import { useState } from "react";
import {
  CloseIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBasketIcon,
  TrashIcon,
} from "../Icons.jsx";
import { Button } from "../Button.jsx";

const CATALOG_IMAGE_PATH = "/catalog/grocery-catalog-sprite.png";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All items" },
  { value: "grocery", label: "Groceries" },
  { value: "household", label: "Household" },
  { value: "personal-care", label: "Personal care" },
  { value: "pharmacy", label: "Health essentials" },
];

const UNIT_OPTIONS = [
  "item",
  "kg",
  "gram",
  "litre",
  "bottle",
  "packet",
  "box",
  "dozen",
  "loaf",
  "roll",
  "sachet",
  "strip",
  "tube",
];

const GROCERY_CATALOG = [
  { id: "rice", name: "Rice", category: "grocery", unit: "kg", row: 0, column: 0 },
  { id: "lentils", name: "Red lentils", category: "grocery", unit: "kg", row: 0, column: 1 },
  { id: "oil", name: "Cooking oil", category: "grocery", unit: "litre", row: 0, column: 2 },
  { id: "eggs", name: "Eggs", category: "grocery", unit: "dozen", row: 0, column: 3 },
  { id: "milk", name: "Milk", category: "grocery", unit: "litre", row: 1, column: 0 },
  { id: "bread", name: "Bread", category: "grocery", unit: "loaf", row: 1, column: 1 },
  { id: "bananas", name: "Bananas", category: "grocery", unit: "dozen", row: 1, column: 2 },
  { id: "apples", name: "Apples", category: "grocery", unit: "kg", row: 1, column: 3 },
  { id: "soap", name: "Bath soap", category: "personal-care", unit: "item", row: 2, column: 0 },
  { id: "toothpaste", name: "Toothpaste", category: "personal-care", unit: "tube", row: 2, column: 1 },
  { id: "tissue", name: "Tissue roll", category: "household", unit: "roll", row: 2, column: 2 },
  { id: "adult-diapers", name: "Adult diapers", category: "personal-care", unit: "packet", row: 2, column: 3 },
  { id: "ors", name: "Oral saline", category: "pharmacy", unit: "sachet", row: 3, column: 0 },
  { id: "bandages", name: "Adhesive bandages", category: "pharmacy", unit: "packet", row: 3, column: 1 },
  { id: "sanitizer", name: "Hand sanitizer", category: "personal-care", unit: "bottle", row: 3, column: 2 },
  { id: "water", name: "Drinking water", category: "grocery", unit: "bottle", row: 3, column: 3 },
];

/**
 * Creates a fresh custom-item draft.
 * @returns {{name: string, category: string, quantity: string, unit: string, notes: string}} Blank custom item.
 * @sideEffects None.
 */
function createCustomItemDraft() {
  return {
    name: "",
    category: "grocery",
    quantity: "1",
    unit: "item",
    notes: "",
  };
}

/**
 * Finds a catalog item in the current cart.
 * @param {object[]} items - Current cart items.
 * @param {string} catalogId - Stable catalog identifier.
 * @returns {number} Matching item index or -1 when absent.
 * @sideEffects None.
 */
function findCartItemIndex(items, catalogId) {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].catalogId === catalogId) {
      return index;
    }
  }

  return -1;
}

/**
 * Returns catalog entries matching the selected category and search text.
 * @param {string} category - Active category filter.
 * @param {string} searchText - User-entered search text.
 * @returns {object[]} Visible catalog items.
 * @sideEffects None.
 */
function getVisibleCatalogItems(category, searchText) {
  const visibleItems = [];
  const normalizedSearch = searchText.trim().toLowerCase();

  for (const item of GROCERY_CATALOG) {
    const matchesCategory = category === "all" || item.category === category;
    const matchesSearch = !normalizedSearch
      || item.name.toLowerCase().includes(normalizedSearch);

    if (matchesCategory && matchesSearch) {
      visibleItems.push(item);
    }
  }

  return visibleItems;
}

/**
 * Renders one cropped product image from the local catalog sprite.
 * @param {{item: object}} props - Catalog item containing its grid position.
 * @returns {import("react").ReactElement} Accessible catalog image.
 * @sideEffects Loads the shared local sprite image.
 */
function CatalogProductImage({ item }) {
  const imageStyle = {
    left: `${item.column * -100}%`,
    top: `${item.row * -100}%`,
  };

  return (
    <span className="grocery-catalog-image">
      <img
        src={CATALOG_IMAGE_PATH}
        alt={item.name}
        draggable="false"
        style={imageStyle}
      />
    </span>
  );
}

/**
 * Displays a searchable product catalog and editable request cart.
 * @param {{items: object[], error?: string, onChange: (items: object[]) => void}} props - Cart state and update handler.
 * @returns {import("react").ReactElement} Catalog, quantity controls, custom item form, and cart.
 * @sideEffects Updates cart items through the supplied handler.
 */
export function GroceryCatalog({ items, error = "", onChange }) {
  const [category, setCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItem, setCustomItem] = useState(createCustomItemDraft);
  const [customItemError, setCustomItemError] = useState("");
  const visibleCatalogItems = getVisibleCatalogItems(category, searchText);

  /**
   * Adds one catalog item or increases its existing quantity.
   * @param {object} catalogItem - Selected predefined item.
   * @returns {void}
   * @sideEffects Calls onChange with a new cart array.
   */
  function addCatalogItem(catalogItem) {
    const itemIndex = findCartItemIndex(items, catalogItem.id);
    const nextItems = [];

    if (itemIndex === -1) {
      if (items.length >= 30) {
        return;
      }

      for (const item of items) {
        nextItems.push(item);
      }

      nextItems.push({
        catalogId: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        quantity: 1,
        unit: catalogItem.unit,
        notes: "",
      });
    } else {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        if (index === itemIndex) {
          nextItems.push({
            ...item,
            quantity: Number(item.quantity) + 1,
          });
        } else {
          nextItems.push(item);
        }
      }
    }

    onChange(nextItems);
  }

  /**
   * Changes one cart quantity and removes the row when it reaches zero.
   * @param {number} itemIndex - Cart item position.
   * @param {number} change - Positive or negative quantity change.
   * @returns {void}
   * @sideEffects Calls onChange with updated cart items.
   */
  function changeCartQuantity(itemIndex, change) {
    const nextItems = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (index !== itemIndex) {
        nextItems.push(item);
        continue;
      }

      const nextQuantity = Number(item.quantity) + change;

      if (nextQuantity > 0) {
        nextItems.push({
          ...item,
          quantity: nextQuantity,
        });
      }
    }

    onChange(nextItems);
  }

  /**
   * Removes one cart item completely.
   * @param {number} itemIndex - Cart item position.
   * @returns {void}
   * @sideEffects Calls onChange with the remaining items.
   */
  function removeCartItem(itemIndex) {
    const nextItems = [];

    for (let index = 0; index < items.length; index += 1) {
      if (index !== itemIndex) {
        nextItems.push(items[index]);
      }
    }

    onChange(nextItems);
  }

  /**
   * Updates one custom-item draft field.
   * @param {string} field - Draft field name.
   * @param {string} value - New field value.
   * @returns {void}
   * @sideEffects Updates custom-item state.
   */
  function updateCustomItem(field, value) {
    setCustomItem(function updateDraft(current) {
      return {
        ...current,
        [field]: value,
      };
    });
    setCustomItemError("");
  }

  /**
   * Opens the small custom-item editor and reuses the current search text.
   * @returns {void}
   * @sideEffects Updates the custom-item draft and reveals its editor.
   */
  function openCustomItemEditor() {
    let selectedCategory = category;

    if (selectedCategory === "all") {
      selectedCategory = "grocery";
    }

    setCustomItem({
      name: searchText.trim(),
      category: selectedCategory,
      quantity: "1",
      unit: "item",
      notes: "",
    });
    setCustomItemError("");
    setIsCustomItemOpen(true);
  }

  /**
   * Adds the custom item draft to the request cart.
   * @returns {void}
   * @sideEffects Validates local fields and updates cart/custom-item state.
   */
  function addCustomItem() {
    const itemName = customItem.name.trim();
    const quantity = Number(customItem.quantity);

    if (!itemName) {
      setCustomItemError("Enter an item name.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCustomItemError("Choose a quantity greater than zero.");
      return;
    }

    if (items.length >= 30) {
      setCustomItemError("A request can contain at most 30 items.");
      return;
    }

    const nextItems = [];

    for (const item of items) {
      nextItems.push(item);
    }

    nextItems.push({
      catalogId: `custom-${Date.now()}`,
      name: itemName,
      category: customItem.category,
      quantity,
      unit: customItem.unit,
      notes: customItem.notes.trim(),
    });

    onChange(nextItems);
    setCustomItem(createCustomItemDraft());
    setCustomItemError("");
    setIsCustomItemOpen(false);
  }

  return (
    <section className="grocery-catalog-workspace" aria-labelledby="grocery-catalog-title">
      <div className="grocery-catalog-main">
        <div className="grocery-item-heading">
          <div>
            <h2 id="grocery-catalog-title">Choose needed items</h2>
            <p>Search the catalog or browse a category, then add quantities to the cart.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={openCustomItemEditor}
          >
            <PlusIcon size={17} />
            Item not listed?
          </Button>
        </div>

        <label className="grocery-catalog-search" htmlFor="grocery-catalog-search">
          <SearchIcon size={18} />
          <input
            id="grocery-catalog-search"
            type="search"
            value={searchText}
            placeholder="Search rice, soap, saline..."
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        <div className="grocery-catalog-categories" aria-label="Item categories">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              type="button"
              className={category === option.value ? "is-active" : ""}
              aria-pressed={category === option.value}
              key={option.value}
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isCustomItemOpen && (
          <section className="grocery-custom-item" aria-labelledby="custom-item-title">
            <div className="grocery-custom-item__heading">
              <div>
                <h3 id="custom-item-title">Add an item not listed</h3>
                <p>Enter only the missing item, quantity, and unit.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close custom item"
                onClick={() => setIsCustomItemOpen(false)}
              >
                <CloseIcon size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="grocery-custom-item__grid">
              <label className="field grocery-custom-item__name">
                <span>Item name</span>
                <input
                  className="input"
                  maxLength={120}
                  value={customItem.name}
                  placeholder="Enter the missing item"
                  onChange={(event) => updateCustomItem("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Quantity</span>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customItem.quantity}
                  onChange={(event) => updateCustomItem("quantity", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Unit</span>
                <select
                  className="input"
                  value={customItem.unit}
                  onChange={(event) => updateCustomItem("unit", event.target.value)}
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <option value={unit} key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </div>
            {customItemError && (
              <p className="field__error" role="alert">{customItemError}</p>
            )}
            <Button type="button" onClick={addCustomItem}>
              Add custom item to cart
            </Button>
          </section>
        )}

        {visibleCatalogItems.length > 0 ? (
          <div className="grocery-catalog-grid">
            {visibleCatalogItems.map((catalogItem) => {
              const cartIndex = findCartItemIndex(items, catalogItem.id);
              const cartItem = cartIndex >= 0 ? items[cartIndex] : null;

              return (
                <article className="grocery-catalog-card" key={catalogItem.id}>
                  <CatalogProductImage item={catalogItem} />
                  <div className="grocery-catalog-card__details">
                    <strong>{catalogItem.name}</strong>
                    <span>per {catalogItem.unit}</span>
                  </div>
                  {cartItem ? (
                    <div className="grocery-quantity-control" aria-label={`${catalogItem.name} quantity`}>
                      <button
                        type="button"
                        aria-label={`Decrease ${catalogItem.name}`}
                        onClick={() => changeCartQuantity(cartIndex, -1)}
                      >
                        <span aria-hidden="true">&minus;</span>
                      </button>
                      <strong>{cartItem.quantity}</strong>
                      <button
                        type="button"
                        aria-label={`Increase ${catalogItem.name}`}
                        onClick={() => changeCartQuantity(cartIndex, 1)}
                      >
                        <PlusIcon size={15} />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => addCatalogItem(catalogItem)}
                    >
                      <PlusIcon size={16} />
                      Add
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grocery-catalog-empty">
            <SearchIcon size={24} />
            <strong>No catalog item matched</strong>
            <span>Try another search or add a custom item.</span>
          </div>
        )}
      </div>

      <aside className="grocery-cart" aria-labelledby="grocery-cart-title">
        <div className="grocery-cart__heading">
          <span aria-hidden="true"><ShoppingBasketIcon size={19} /></span>
          <div>
            <h2 id="grocery-cart-title">Request cart</h2>
            <p>{items.length} {items.length === 1 ? "item" : "items"} selected</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="grocery-cart__empty">
            <ShoppingBasketIcon size={26} />
            <strong>Your cart is empty</strong>
            <span>Add an item from the catalog to begin.</span>
          </div>
        ) : (
          <div className="grocery-cart__items">
            {items.map((item, index) => (
              <article className="grocery-cart-item" key={item.catalogId}>
                <div className="grocery-cart-item__heading">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} {item.unit}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeCartItem(index)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
                <div className="grocery-cart-item__controls">
                  <div className="grocery-quantity-control">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() => changeCartQuantity(index, -1)}
                    >
                      <span aria-hidden="true">&minus;</span>
                    </button>
                    <strong>{item.quantity}</strong>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name}`}
                      onClick={() => changeCartQuantity(index, 1)}
                    >
                      <PlusIcon size={15} />
                    </button>
                  </div>
                  <span>{item.unit}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {error && <p className="field__error grocery-cart__error" role="alert">{error}</p>}
      </aside>
    </section>
  );
}
