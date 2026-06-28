import SwiftUI

struct ContentView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false

    var body: some View {
        if isLoggedIn {
            MainTabView()
                .transition(.opacity)
        } else {
            OnboardingView()
                .transition(.opacity)
        }
    }
}

struct MainTabView: View {
    @State private var selectedTab = 0
    @State private var showCreateListing = false

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                FeedView(showCreateListing: $showCreateListing)
                    .tag(0)
                    .tabItem {
                        Label("Browse", systemImage: "square.grid.2x2")
                    }

                OffersTabView()
                    .tag(1)
                    .tabItem {
                        Label("Offers", systemImage: "text.bubble")
                    }

                Text("")
                    .tag(2)
                    .tabItem {
                        Label("Sell", systemImage: "plus.circle.fill")
                    }

                OrdersListView()
                    .tag(3)
                    .tabItem {
                        Label("Orders", systemImage: "bag")
                    }

                ProfileView()
                    .tag(4)
                    .tabItem {
                        Label("Profile", systemImage: "person.crop.circle")
                    }
            }
        }
        .onChange(of: selectedTab) { _, newValue in
            if newValue == 2 {
                showCreateListing = true
                selectedTab = 0
            }
        }
        .sheet(isPresented: $showCreateListing) {
            CreateListingView()
        }
    }
}

struct OffersTabView: View {
    @State private var offers: [Offer] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if offers.isEmpty {
                    ContentUnavailableView("No Offers", systemImage: "text.bubble", description: Text("Your offers on items will appear here."))
                } else {
                    List(offers) { offer in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(offer.listing?.title ?? "Item")
                                    .font(.subheadline.bold())
                                    .lineLimit(1)
                                Text("AED \(Int(offer.amount))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            StatusPill(
                                label: offer.status.capitalized,
                                color: offerStatusColor(offer.status)
                            )
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("My Offers")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        do { offers = try await APIClient.shared.getMyOffers() } catch {}
        isLoading = false
    }

    private func offerStatusColor(_ status: String) -> Color {
        switch status {
        case "accepted": return .green
        case "rejected": return .red
        case "expired": return .gray
        case "countered": return .orange
        default: return .blue
        }
    }
}
