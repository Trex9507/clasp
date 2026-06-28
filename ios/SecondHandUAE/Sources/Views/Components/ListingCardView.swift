import SwiftUI

struct ListingCardView: View {
    let listing: Listing

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Color(.systemGray6)
                    .aspectRatio(0.85, contentMode: .fit)
                    .overlay {
                        if let photo = listing.photos?.first {
                            AsyncImage(url: URL(string: photo.url)) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Color(.systemGray5)
                            }
                        } else {
                            Image(systemName: "photo")
                                .font(.title2)
                                .foregroundStyle(.quaternary)
                        }
                    }
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cardCornerRadius))

                if listing.verificationStatus == "verified" {
                    VerifiedBadge()
                        .padding(8)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                if let brand = listing.brand {
                    Text(brand.name.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(0.5)
                }

                Text(listing.title)
                    .font(.caption)
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                HStack(spacing: 4) {
                    PriceTag(amount: listing.price, font: .footnote)

                    if let size = listing.size, !size.isEmpty {
                        Text("·")
                            .foregroundStyle(.quaternary)
                        Text(size)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 4)
        }
    }
}
