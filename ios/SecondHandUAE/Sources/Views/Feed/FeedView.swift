import SwiftUI

struct FeedView: View {
    @Binding var showCreateListing: Bool

    @State private var listings: [Listing] = []
    @State private var verifiedOnly = false
    @State private var searchText = ""
    @State private var isLoading = false

    private let columns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Verified filter
                    HStack(spacing: 8) {
                        Button {
                            verifiedOnly.toggle()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: verifiedOnly ? "checkmark.seal.fill" : "checkmark.seal")
                                    .font(.caption)
                                Text("Verified only")
                                    .font(.caption.weight(.medium))
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(verifiedOnly ? Color.blue : Color(.tertiarySystemFill))
                            .foregroundStyle(verifiedOnly ? .white : .primary)
                            .clipShape(Capsule())
                        }

                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)

                    if isLoading && listings.isEmpty {
                        VStack {
                            Spacer(minLength: 120)
                            ProgressView()
                            Spacer(minLength: 120)
                        }
                    } else if listings.isEmpty {
                        VStack(spacing: 12) {
                            Spacer(minLength: 80)
                            Image(systemName: "tray")
                                .font(.system(size: 40))
                                .foregroundStyle(.quaternary)
                            Text("No items found")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Spacer(minLength: 80)
                        }
                    } else {
                        LazyVGrid(columns: columns, spacing: 18) {
                            ForEach(listings) { listing in
                                NavigationLink(destination: ListingDetailView(listingId: listing.id)) {
                                    ListingCardView(listing: listing)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                    }
                }
            }
            .navigationTitle("Browse")
            .searchable(text: $searchText, prompt: "Search items...")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showCreateListing = true } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                }
            }
            .task { await loadListings() }
            .onChange(of: verifiedOnly) { _, _ in Task { await loadListings() } }
            .onChange(of: searchText) { _, _ in Task { await loadListings() } }
            .refreshable { await loadListings() }
        }
    }

    private func loadListings() async {
        isLoading = true
        do {
            let response = try await APIClient.shared.getListings(
                verifiedOnly: verifiedOnly,
                query: searchText.isEmpty ? nil : searchText
            )
            listings = response.items
        } catch {}
        isLoading = false
    }
}
