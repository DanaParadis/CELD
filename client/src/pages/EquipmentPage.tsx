
import type { Equipment } from '../types/equipment'

interface EquipmentPageProps {
  equipment: Equipment[]
  search: string
  onSearchChange: (value: string) => void
  selectedCategory: string
  categories: string[]
  onCategoryChange: (value: string) => void
  isLoading: boolean
  error: string
  onRetry: () => void
  onViewDetails: (id: number) => void
}

function EquipmentPage({
  equipment,
  search,
  onSearchChange,
  selectedCategory,
  categories,
  onCategoryChange,
  isLoading,
  error,
  onRetry,
  onViewDetails,
}: EquipmentPageProps) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">CAMPUS EQUIPMENT LENDING DESK</p>
        <h1>Find the equipment you need.</h1>
        <p className="hero-description">
          Browse campus equipment, make a reservation, and track its lending status.
        </p>

        <div className="search-container">
          <label htmlFor="equipment-search">Search equipment</label>
          <input
            id="equipment-search"
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </section>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">CATALOG</p>
            <h2 id="catalog-title">Explore equipment</h2>
          </div>
          <span className="equipment-count">{equipment.length} items</span>
        </div>

        <div className="category-filter">
          <label htmlFor="category">Category:</label>
          <select
            id="category"
            value={selectedCategory || 'All categories'}
            onChange={(event) =>
              onCategoryChange(
                event.target.value === 'All categories' ? '' : event.target.value
              )
            }
          >
            <option value="All categories">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <p className="loading-message" role="status">
            Loading equipment...
          </p>
        )}

        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}

        {!isLoading && !error && (
          equipment.length > 0 ? (
            <div className="equipment-grid">
              {equipment.map((item) => (
                <article className="equipment-card" key={item.id}>
                  <div className="equipment-image" aria-hidden="true">
                    <span>▣</span>
                  </div>

                  <div className="equipment-info">
                    <span className="category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <p>Asset code: {item.assetCode}</p>

                    <span
                      className={`availability ${
                        item.isAvailable ? 'available' : 'unavailable'
                      }`}
                    >
                      {item.isAvailable ? 'Available' : 'Unavailable'}
                    </span>

                    <button
                      className="text-button"
                      onClick={() => onViewDetails(item.id)}
                    >
                      View details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-message">
              No equipment matches these search filters.
            </p>
          )
        )}
      </section>
    </>
  )
}

export default EquipmentPage
