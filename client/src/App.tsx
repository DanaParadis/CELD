
import { useEffect, useState } from 'react'
import type { Equipment } from './types/equipment'
import { getEquipment } from './services/equipmentService'
import './App.css'

function App() {
  // Estados de la aplicación
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Obtener los equipos desde la API
  useEffect(() => {
    async function loadEquipment() {
      try {
        setIsLoading(true)
        setError(null)

        const data = await getEquipment()
        setEquipment(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Ocurrió un error al cargar los equipos.'
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadEquipment()
  }, [])

  // Obtener las categorías disponibles
  const categories = [
    'Todas',
    ...new Set(equipment.map((item) => item.category)),
  ]

  // Filtrar equipos por nombre y categoría
  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(search.toLowerCase().trim())

    const matchesCategory =
      selectedCategory === 'Todas' ||
      item.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  return (
    <div className="app">
      {/* Navegación */}
      <header className="navbar">
        <div className="brand">
          <span className="brand-icon">C</span>
          <span>CELD</span>
        </div>

        <nav>
          <a href="#catalog">Catálogo</a>
          <a href="#about">Acerca de</a>
        </nav>

        <button className="login-button">
          Iniciar sesión
        </button>
      </header>

      <main>
        {/* Sección principal */}
        <section className="hero">
          <p className="eyebrow">
            CAMPUS EQUIPMENT LENDING DESK
          </p>

          <h1>Encuentra el equipo que necesitas.</h1>

          <p className="hero-description">
            Explora los equipos disponibles en el campus y encuentra
            lo que necesitas para tus estudios.
          </p>

          {/* Buscador */}
          <div className="search-container">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Buscar equipos..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </section>

        {/* Catálogo */}
        <section className="catalog" id="catalog">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">CATÁLOGO</p>
              <h2>Explorar equipos</h2>
            </div>

            <span className="equipment-count">
              {filteredEquipment.length} equipos
            </span>
          </div>

          {/* Filtro por categoría */}
          <div className="category-filter">
            <label htmlFor="category">Categoría:</label>

            <select
              id="category"
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value)
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Estado de carga */}
          {isLoading && (
            <p className="loading-message">
              Cargando equipos...
            </p>
          )}

          {/* Estado de error */}
          {!isLoading && error && (
            <div className="error-message">
              <p>{error}</p>

              <button onClick={() => window.location.reload()}>
                Intentar nuevamente
              </button>
            </div>
          )}

          {/* Resultados del catálogo */}
          {!isLoading && !error && (
            <>
              <div className="equipment-grid">
                {filteredEquipment.map((item) => (
                  <article
                    className="equipment-card"
                    key={item.id}
                    onClick={() => setSelectedEquipment(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedEquipment(item)
                      }
                    }}
                  >
                    <div className="equipment-image">
                      <span>▣</span>
                    </div>

                    <div className="equipment-info">
                      <span className="category">
                        {item.category}
                      </span>

                      <h3>{item.name}</h3>

                      <p>
                        Identificador: {item.assetCode}
                      </p>

                      <span
                        className={`availability ${
                          item.availability === 'Available'
                            ? 'available'
                            : 'unavailable'
                        }`}
                      >
                        {item.availability === 'Available'
                          ? 'Disponible'
                          : 'No disponible'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {/* Mensaje sin resultados */}
              {filteredEquipment.length === 0 && (
                <p className="empty-message">
                  No se encontraron equipos.
                </p>
              )}
            </>
          )}
        </section>
      </main>

      {/* Ventana modal de detalles */}
      {selectedEquipment && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedEquipment(null)}
        >
          <div
            className="equipment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedEquipment(null)}
              aria-label="Cerrar detalles"
            >
              &times;
            </button>

            <p className="eyebrow">
              DETALLES DEL EQUIPO
            </p>

            <h2 id="equipment-modal-title">
              {selectedEquipment.name}
            </h2>

            <p>
              <strong>Código de activo:</strong>{' '}
              {selectedEquipment.assetCode}
            </p>

            <p>
              <strong>Categoría:</strong>{' '}
              {selectedEquipment.category}
            </p>

            <p>
              <strong>Descripción:</strong>{' '}
              {selectedEquipment.description}
            </p>

            <p>
              <strong>Disponibilidad:</strong>{' '}
              <span
                className={
                  selectedEquipment.availability === 'Available'
                    ? 'available'
                    : 'unavailable'
                }
              >
                {selectedEquipment.availability === 'Available'
                  ? 'Disponible'
                  : 'No disponible'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer>
        <p>CELD · Campus Equipment Lending Desk</p>
      </footer>
    </div>
  )
}

export default App
