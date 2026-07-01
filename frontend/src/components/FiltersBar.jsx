import { Search } from "lucide-react";

function FiltersBar({
  search,
  setSearch,
  selectedConsumer,
  setSelectedConsumer,
  selectedProvider,
  setSelectedProvider,
  selectedCategory,
  setSelectedCategory,
  consumers,
  providers,
  categories
}) {
  return (
    <section className="filters-card">
      <div className="search-box">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by consumer, provider, model or category..."
        />
      </div>

      <select>
        <option>Last 7 days</option>
        <option>Last 30 days</option>
        <option>This month</option>
      </select>

      <select value={selectedConsumer} onChange={(event) => setSelectedConsumer(event.target.value)}>
        <option value="all">All consumers</option>
        {consumers.map((consumer) => (
          <option value={consumer} key={consumer}>
            {consumer}
          </option>
        ))}
      </select>

      <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
        <option value="all">All providers</option>
        {providers.map((provider) => (
          <option value={provider} key={provider}>
            {provider}
          </option>
        ))}
      </select>

      <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option value={category} key={category}>
            {category}
          </option>
        ))}
      </select>
    </section>
  );
}

export default FiltersBar;
