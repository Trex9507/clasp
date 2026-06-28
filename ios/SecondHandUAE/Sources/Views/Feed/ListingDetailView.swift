import SwiftUI

struct ListingDetailView: View {
    let listingId: String
    @AppStorage("userId") private var userId = ""
    @State private var listing: Listing?
    @State private var isLoading = true
    @State private var showOfferSheet = false
    @State private var showBuySheet = false

    private var isOwnListing: Bool { listing?.sellerId == userId }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                if isLoading {
                    ProgressView().padding(.top, 120)
                } else if let listing {
                    VStack(alignment: .leading, spacing: 0) {
                        // Photo carousel
                        TabView {
                            ForEach(listing.photos ?? []) { photo in
                                AsyncImage(url: URL(string: photo.url)) { image in
                                    image.resizable().scaledToFill()
                                } placeholder: {
                                    Color(.systemGray6)
                                }
                                .clipped()
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .automatic))
                        .frame(height: 420)

                        VStack(alignment: .leading, spacing: 16) {
                            // Price + verified
                            HStack(alignment: .center) {
                                Text("AED \(Int(listing.price))")
                                    .font(.title.bold())
                                Spacer()
                                if listing.verificationStatus == "verified" {
                                    VerifiedBadge(size: .caption)
                                }
                            }

                            // Title + brand
                            VStack(alignment: .leading, spacing: 4) {
                                Text(listing.title)
                                    .font(.title3.weight(.medium))
                                if let brand = listing.brand {
                                    Text(brand.name.uppercased())
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .tracking(1)
                                }
                            }

                            // Disclaimer
                            if listing.verificationStatus == "verified" {
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: "info.circle")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.top, 1)
                                    Text("\"Verified\" means the seller provided a code in the expected format plus a photo. It does not certify authenticity.")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(12)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                            }

                            // Details chips
                            FlowLayout(spacing: 8) {
                                detailChip(icon: "sparkles", text: listing.condition.replacingOccurrences(of: "_", with: " ").capitalized)
                                if let size = listing.size, !size.isEmpty {
                                    detailChip(icon: "ruler", text: size)
                                }
                                detailChip(icon: "shippingbox", text: listing.deliveryOptions?.replacingOccurrences(of: "_", with: " ").capitalized ?? "")
                            }

                            // Description
                            if let desc = listing.description, !desc.isEmpty {
                                Text(desc)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .padding(.top, 4)
                            }

                            // Seller card
                            if let seller = listing.seller {
                                Divider().padding(.vertical, 4)

                                HStack(spacing: 12) {
                                    AvatarView(url: seller.profilePhotoUrl, size: 44)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(seller.name)
                                            .font(.subheadline.bold())
                                        HStack(spacing: 4) {
                                            Image(systemName: "mappin")
                                                .font(.caption2)
                                            Text(seller.city.replacingOccurrences(of: "_", with: " ").capitalized)
                                        }
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    }

                                    Spacer()

                                    if let avg = seller.ratingAvg, let count = seller.ratingCount, count > 0 {
                                        VStack(spacing: 2) {
                                            HStack(spacing: 2) {
                                                Image(systemName: "star.fill")
                                                    .foregroundStyle(.yellow)
                                                Text(String(format: "%.1f", avg))
                                                    .fontWeight(.semibold)
                                            }
                                            .font(.caption)
                                            Text("\(count) reviews")
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .padding(14)
                                .background(Color(.tertiarySystemFill))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                        .padding(20)
                        .padding(.bottom, 100)
                    }
                }
            }

            // Bottom action bar
            if let listing, listing.status == "active", !isOwnListing {
                VStack(spacing: 0) {
                    Divider()
                    HStack(spacing: 12) {
                        Button("Make an Offer") {
                            showOfferSheet = true
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        Button("Buy Now") {
                            showBuySheet = true
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(.ultraThinMaterial)
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .ignoresSafeArea(.container, edges: .top)
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

    private func detailChip(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2)
            Text(text).font(.caption)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color(.tertiarySystemFill))
        .clipShape(Capsule())
    }

    private func reload() async {
        do { listing = try await APIClient.shared.getListing(id: listingId) } catch {}
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(in: proposal.width ?? 0, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(in: bounds.width, subviews: subviews)
        for (index, point) in result.points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func layout(in width: CGFloat, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var points: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxWidth = max(maxWidth, x - spacing)
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), points)
    }
}
