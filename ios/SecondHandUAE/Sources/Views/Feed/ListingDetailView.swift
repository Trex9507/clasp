import SwiftUI

struct ListingDetailView: View {
    let listingId: String
    @AppStorage("userId") private var userId = ""
    @State private var listing: Listing?
    @State private var isLoading = true
    @State private var showOfferSheet = false
    @State private var showBuySheet = false
    @State private var errorMessage: String?

    private var isOwnListing: Bool { listing?.sellerId == userId }

    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView().padding(.top, 100)
            } else if let listing {
                VStack(alignment: .leading, spacing: 16) {
                    // Photos
                    TabView {
                        ForEach(listing.photos ?? []) { photo in
                            AsyncImage(url: URL(string: photo.url)) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                Color(.systemGray5)
                            }
                        }
                    }
                    .tabViewStyle(.page)
                    .frame(height: 300)

                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("AED \(Int(listing.price))")
                                .font(.title2.bold())
                            Spacer()
                            if listing.verificationStatus == "verified" {
                                Label("Verified", systemImage: "checkmark.seal.fill")
                                    .font(.caption)
                                    .foregroundStyle(.blue)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.blue.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }

                        if listing.verificationStatus == "verified" {
                            Text("\"Verified\" means the seller provided a code in the expected format plus a photo. It does not certify authenticity.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(8)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }

                        Text(listing.title).font(.title3)

                        if let brand = listing.brand {
                            Text(brand.name).foregroundStyle(.secondary)
                        }

                        if let description = listing.description {
                            Text(description).font(.body)
                        }

                        HStack(spacing: 16) {
                            Label(listing.condition.replacingOccurrences(of: "_", with: " ").capitalized, systemImage: "sparkles")
                            if let size = listing.size {
                                Label(size, systemImage: "ruler")
                            }
                        }
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                        if let seller = listing.seller {
                            Divider()
                            HStack {
                                Image(systemName: "person.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(.secondary)
                                VStack(alignment: .leading) {
                                    Text(seller.name).font(.subheadline.bold())
                                    Text(seller.city.capitalized).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }

                        if let errorMessage {
                            Text(errorMessage).font(.caption).foregroundStyle(.red)
                        }

                        if listing.status == "active" && !isOwnListing {
                            VStack(spacing: 8) {
                                Button("Buy Now — AED \(Int(listing.price))") {
                                    showBuySheet = true
                                }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.large)
                                .frame(maxWidth: .infinity)

                                Button("Make an Offer") {
                                    showOfferSheet = true
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.large)
                                .frame(maxWidth: .infinity)
                            }
                            .padding(.top)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do { listing = try await APIClient.shared.getListing(id: listingId) } catch {}
            isLoading = false
        }
        .sheet(isPresented: $showOfferSheet) {
            MakeOfferView(listing: listing!) { await reload() }
        }
        .sheet(isPresented: $showBuySheet) {
            BuyNowView(listing: listing!)
        }
    }

    private func reload() async {
        do { listing = try await APIClient.shared.getListing(id: listingId) } catch {}
    }
}
