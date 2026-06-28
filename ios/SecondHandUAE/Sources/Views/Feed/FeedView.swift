import SwiftUI

struct FeedView: View {
    @State private var listings: [Listing] = []
    @State private var verifiedOnly = false
    @State private var searchText = ""
    @State private var isLoading = false
    @State private var showCreateListing = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Verified filter toggle
                HStack {
                    Toggle(isOn: $verifiedOnly) {
                        Label("Verified only", systemImage: "checkmark.seal.fill")
                            .font(.subheadline)
                    }
                    .toggleStyle(.switch)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .background(Color(.systemBackground))

                if isLoading && listings.isEmpty {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else {
                    ScrollView {
                        LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 12) {
                            ForEach(listings) { listing in
                                NavigationLink(destination: ListingDetailView(listingId: listing.id)) {
                                    ListingCardView(listing: listing)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Browse")
            .searchable(text: $searchText, prompt: "Search items...")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateListing = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showCreateListing) {
                CreateListingView()
            }
            .task { await loadListings() }
            .onChange(of: verifiedOnly) { _, _ in Task { await loadListings() } }
            .onChange(of: searchText) { _, _ in Task { await loadListings() } }
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
        } catch {
            // Silently fail for MVP — in production show error
        }
        isLoading = false
    }
}
